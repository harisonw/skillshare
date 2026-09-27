package server

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"skillshare/internal/config"
	"skillshare/internal/instructions"
)

// errInstructionsInUse is the error code for moving or removing a target's
// instruction file while shared instruction files are attached to it.
const errInstructionsInUse = "instructions_in_use"

// setTargetInstructionsConfig sets (ic != nil) or clears the user-set
// instruction file of a target in the config of the current mode. Callers
// must hold s.mu and save the config afterwards.
func (s *Server) setTargetInstructionsConfig(name string, ic *config.TargetInstructionsConfig) {
	tc := s.cfg.Targets[name]
	tc.Instructions = ic
	s.cfg.Targets[name] = tc
	if !s.IsProjectMode() {
		return
	}
	for i := range s.projectCfg.Targets {
		if s.projectCfg.Targets[i].Name == name {
			s.projectCfg.Targets[i].Instructions = ic
			return
		}
	}
}

// attachedShared returns the shared instruction files attached to the
// target's current instruction file. Callers must hold s.mu.
func (s *Server) attachedShared(name string) []instructions.Assignment {
	it, _, ok := s.targetInstructions(name)
	if !ok {
		return nil
	}
	return instructions.Assignments(s.extrasConfig(), it.Path, s.instructionsResolver())
}

func writeInstructionsInUse(w http.ResponseWriter, name string) {
	writeCodedError(w, http.StatusConflict, errInstructionsInUse,
		name+" uses shared instruction files; switch it back to its own file first",
		map[string]string{"target": name})
}

// handlePutTargetInstructionsSetup — PUT /api/targets/{name}/instructions/setup
// Tells skillshare which instruction file the target reads.
func (s *Server) handlePutTargetInstructionsSetup(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	name := r.PathValue("name")
	var body struct {
		Path   string `json:"path"`
		Import bool   `json:"import"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	ic := &config.TargetInstructionsConfig{Path: strings.TrimSpace(body.Path), Import: body.Import}
	if err := config.ValidateTargetInstructions(ic, s.IsProjectMode()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	tc, found := s.cfg.Targets[name]
	if !found {
		writeError(w, http.StatusNotFound, "target not found: "+name)
		return
	}
	if tc.ProjectRoot() != "" {
		writeError(w, http.StatusBadRequest, name+" belongs to a project; edit the project instead")
		return
	}
	// Shared files are attached to the current path; moving it would strand them.
	old, _, hadFile := s.targetInstructions(name)
	shared := s.attachedShared(name)
	tc.Instructions = ic
	next, _ := config.TargetInstructions(name, tc, s.IsProjectMode())
	if hadFile && len(shared) > 0 && filepath.Clean(old.Path) != filepath.Clean(instructions.Resolve(next, s.projectRoot).Path) {
		writeInstructionsInUse(w, name)
		return
	}

	s.setTargetInstructionsConfig(name, ic)
	args := map[string]any{"target": name, "path": ic.Path, "import": ic.Import, "scope": "ui"}
	if err := s.saveAndReloadConfig(); err != nil {
		s.writeOpsLog("instructions-setup", "error", start, args, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-setup", "ok", start, args, "")
	writeJSON(w, map[string]any{"success": true})
}

// handleDeleteTargetInstructionsSetup — DELETE /api/targets/{name}/instructions/setup
// Forgets the user-set instruction file; the built-in one, if any, applies again.
func (s *Server) handleDeleteTargetInstructionsSetup(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	name := r.PathValue("name")
	s.mu.Lock()
	defer s.mu.Unlock()
	tc, found := s.cfg.Targets[name]
	if !found {
		writeError(w, http.StatusNotFound, "target not found: "+name)
		return
	}
	if tc.Instructions == nil {
		writeJSON(w, map[string]any{"success": true})
		return
	}
	if len(s.attachedShared(name)) > 0 {
		writeInstructionsInUse(w, name)
		return
	}

	s.setTargetInstructionsConfig(name, nil)
	args := map[string]any{"target": name, "scope": "ui"}
	if err := s.saveAndReloadConfig(); err != nil {
		s.writeOpsLog("instructions-setup-remove", "error", start, args, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-setup-remove", "ok", start, args, "")
	writeJSON(w, map[string]any{"success": true})
}
