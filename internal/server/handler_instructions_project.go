package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"skillshare/internal/config"
	"skillshare/internal/instructions"
)

// In project mode every target reads the one ./AGENTS.md, so there is nothing
// to share or sync; a few targets need a small file (a shim) to reach it.

func (s *Server) requireProjectInstructions(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.IsProjectMode() {
			writeError(w, http.StatusBadRequest, "the project AGENTS.md is available in project mode")
			return
		}
		next(w, r)
	}
}

// projectReaches reports how each configured target reaches ./AGENTS.md.
// Callers must hold s.mu.
func (s *Server) projectReaches() []instructions.Reach {
	names := make([]string, 0, len(s.cfg.Targets))
	for name := range s.cfg.Targets {
		names = append(names, name)
	}
	sort.Strings(names)
	out := []instructions.Reach{}
	for _, name := range names {
		if it, ok := config.TargetInstructions(name, s.cfg.Targets[name], true); ok {
			out = append(out, instructions.ProjectReach(s.projectRoot, name, it))
		}
	}
	return out
}

// handleGetProjectInstructions — GET /api/instructions/project
func (s *Server) handleGetProjectInstructions(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	path := filepath.Join(s.projectRoot, instructions.AgentsFile)
	resp := map[string]any{"path": path, "exists": false, "content": "", "size": 0, "targets": s.projectReaches()}
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		data, err := readLimited(path)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["exists"], resp["content"], resp["size"] = true, string(data), info.Size()
	}
	writeJSON(w, resp)
}

// handlePutProjectInstructions — PUT /api/instructions/project
func (s *Server) handlePutProjectInstructions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxInstructionsBytes+4096)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.projectRoot, instructions.AgentsFile)
	if err := writeInstructionsFile(path, body.Content); err != nil {
		s.writeOpsLog("instructions-edit", "error", start, map[string]any{"path": path, "scope": "ui"}, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-edit", "ok", start, map[string]any{"path": path, "scope": "ui"}, "")
	writeJSON(w, map[string]any{"success": true, "path": path})
}

// handleProjectInstructionsShim — POST /api/instructions/project/shim
// Adds the shim a target needs to read ./AGENTS.md.
func (s *Server) handleProjectInstructionsShim(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var body struct {
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Target == "" {
		writeError(w, http.StatusBadRequest, "target is required")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	tc, found := s.cfg.Targets[body.Target]
	if !found {
		writeError(w, http.StatusNotFound, "target not found: "+body.Target)
		return
	}
	it, ok := config.TargetInstructions(body.Target, tc, true)
	if !ok {
		writeError(w, http.StatusBadRequest, body.Target+" has no instruction file")
		return
	}
	reach := instructions.ProjectReach(s.projectRoot, body.Target, it)
	if reach.Shim == "" {
		writeError(w, http.StatusBadRequest, body.Target+" needs no change to read "+instructions.AgentsFile)
		return
	}
	args := map[string]any{"target": body.Target, "shim": reach.Shim, "scope": "ui"}
	if err := instructions.ApplyShim(s.projectRoot, it, reach.Shim); err != nil {
		s.writeOpsLog("instructions-shim", "error", start, args, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-shim", "ok", start, args, "")
	writeJSON(w, map[string]any{"success": true, "target": instructions.ProjectReach(s.projectRoot, body.Target, it)})
}
