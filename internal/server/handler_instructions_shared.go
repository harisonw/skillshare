package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"time"
	"unicode/utf8"

	"skillshare/internal/config"
	"skillshare/internal/instructions"
	syncpkg "skillshare/internal/sync"
)

// Shared instruction files are single-file extras attached to the global
// instruction files of targets. Project mode has one ./AGENTS.md instead
// (handler_instructions_project.go).

func (s *Server) requireGlobalInstructions(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.IsProjectMode() {
			writeError(w, http.StatusBadRequest, "shared instruction files are set up in global mode")
			return
		}
		next(w, r)
	}
}

type sharedInstructionsFile struct {
	Name    string `json:"name"`
	File    string `json:"file"`
	Path    string `json:"path"`
	Exists  bool   `json:"exists"`
	Size    int64  `json:"size"`
	Chars   int    `json:"chars"`
	Targets int    `json:"targets"`
}

type sharedInstructionsTarget struct {
	Name     string                    `json:"name"`
	Path     string                    `json:"path"`
	Import   bool                      `json:"import"`
	Exists   bool                      `json:"exists"`
	SameAs   string                    `json:"same_as,omitempty"` // locked to this target: both read the same file
	MaxChars int                       `json:"max_chars,omitempty"`
	Assigned []instructions.Assignment `json:"assigned"`
}

// instructionTargets returns the configured targets with a global instruction
// file, sorted by name. Callers must hold s.mu.
func (s *Server) instructionTargets() []sharedInstructionsTarget {
	names := make([]string, 0, len(s.cfg.Targets))
	for name := range s.cfg.Targets {
		names = append(names, name)
	}
	sort.Strings(names)
	res := s.instructionsResolver()
	out := []sharedInstructionsTarget{}
	for _, name := range names {
		it, ok := config.TargetInstructions(name, s.cfg.Targets[name], false)
		if !ok {
			continue
		}
		t := sharedInstructionsTarget{Name: name, Path: it.Path, Import: it.Import, MaxChars: it.MaxChars}
		if _, found := s.cfg.Targets[it.SameAs]; found {
			t.SameAs = it.SameAs
		}
		_, err := os.Stat(it.Path)
		t.Exists = err == nil
		t.Assigned = instructions.Assignments(s.cfg.Extras, it.Path, res)
		out = append(out, t)
	}
	return out
}

// handleListSharedInstructions — GET /api/instructions
func (s *Server) handleListSharedInstructions(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	files := []sharedInstructionsFile{}
	for _, extra := range s.cfg.Extras {
		if extra.File == "" {
			continue
		}
		f := sharedInstructionsFile{Name: extra.Name, File: extra.File, Path: filepath.Join(s.extrasSourceDir(extra), extra.File), Targets: len(extra.Targets)}
		if data, err := readLimited(f.Path); err == nil {
			f.Exists, f.Size, f.Chars = true, int64(len(data)), utf8.RuneCount(data)
		}
		files = append(files, f)
	}
	writeJSON(w, map[string]any{"files": files, "targets": s.instructionTargets()})
}

// handleCreateSharedInstructions — POST /api/instructions
// Creates a shared instruction file with content, unattached, or moves a
// target's current file into it (from_target) and attaches that target, so
// the content is not read twice.
func (s *Server) handleCreateSharedInstructions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var body struct {
		Name       string `json:"name"`
		Content    string `json:"content"`
		FromTarget string `json:"from_target,omitempty"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxInstructionsBytes+4096)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := config.ValidateExtraName(body.Name); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := config.ValidateExtraNameUnique(body.Name, s.cfg.Extras); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	extra := config.ExtraConfig{Name: body.Name, File: instructions.AgentsFile, Targets: []config.ExtraTargetConfig{}}
	path := filepath.Join(s.extrasSourceDir(extra), extra.File)
	if _, err := os.Lstat(path); err == nil {
		writeError(w, http.StatusConflict, path+" already exists")
		return
	}
	args := map[string]any{"name": body.Name, "from_target": body.FromTarget, "scope": "ui"}
	fail := func(status int, err error) {
		s.writeOpsLog("instructions-create", "error", start, args, err.Error())
		writeError(w, status, err.Error())
	}

	if body.FromTarget == "" {
		if err := instructions.WriteFile(path, body.Content); err != nil {
			fail(http.StatusInternalServerError, err)
			return
		}
		s.cfg.Extras = append(s.cfg.Extras, extra)
	} else if status, err := s.moveTargetIntoShared(body.FromTarget, &extra, path); err != nil {
		fail(status, err)
		return
	}
	if err := s.saveAndReloadConfig(); err != nil {
		fail(http.StatusInternalServerError, err)
		return
	}
	s.writeOpsLog("instructions-create", "ok", start, args, "")
	writeJSON(w, map[string]any{"success": true, "name": body.Name, "path": path})
}

// moveTargetIntoShared moves the named target's file into the new shared file
// at path and attaches the target to it. An import target keeps only its
// tool lines plus the managed import (as convert does); any other target is
// backed up and linked. It appends extra to the config. Callers must hold
// s.mu and save the config afterwards.
func (s *Server) moveTargetIntoShared(target string, extra *config.ExtraConfig, path string) (int, error) {
	tc, found := s.cfg.Targets[target]
	if !found {
		return http.StatusBadRequest, fmt.Errorf("target not found: %s", target)
	}
	it, ok := config.TargetInstructions(target, tc, false)
	if !ok {
		return http.StatusBadRequest, fmt.Errorf("%s has no global instruction file", target)
	}
	if _, linked := s.cfg.Targets[it.SameAs]; linked {
		return http.StatusBadRequest, fmt.Errorf("%s reads the same file as %s; use %s instead", target, it.SameAs, it.SameAs)
	}

	if it.Import {
		changes, err := instructions.PlanConvert(it.Path, instructions.ConvertOptions{
			Method: instructions.MethodImport, KeepToolLines: true, Dest: path, Managed: true,
		})
		if err != nil {
			return http.StatusBadRequest, err
		}
		if err := instructions.Apply(changes); err != nil {
			return http.StatusInternalServerError, err
		}
		extra.Targets = append(extra.Targets, config.ExtraTargetConfig{Path: filepath.Dir(it.Path), As: filepath.Base(it.Path), Mode: "import"})
		s.cfg.Extras = append(s.cfg.Extras, *extra)
		return 0, nil
	}

	data, err := readLimited(it.Path)
	if err != nil {
		return http.StatusBadRequest, fmt.Errorf("could not read %s: %w", it.Path, err)
	}
	if err := instructions.WriteFile(path, string(data)); err != nil {
		return http.StatusInternalServerError, err
	}
	s.cfg.Extras = append(s.cfg.Extras, *extra)
	if err := s.assignTarget(target, []string{extra.Name}); err != nil {
		// The shared file exists; keep it in the config so it is not orphaned.
		if saveErr := s.saveAndReloadConfig(); saveErr != nil {
			err = fmt.Errorf("%w; %v", err, saveErr)
		}
		return http.StatusInternalServerError, err
	}
	return 0, nil
}

// sharedExtra returns the named single-file extra. Callers must hold s.mu.
func (s *Server) sharedExtra(name string) (config.ExtraConfig, bool) {
	for _, extra := range s.cfg.Extras {
		if extra.Name == name && extra.File != "" {
			return extra, true
		}
	}
	return config.ExtraConfig{}, false
}

// handleGetSharedInstructionsContent — GET /api/instructions/{name}/content
func (s *Server) handleGetSharedInstructionsContent(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	s.mu.RLock()
	defer s.mu.RUnlock()
	extra, ok := s.sharedExtra(name)
	if !ok {
		writeError(w, http.StatusNotFound, "shared instruction file not found: "+name)
		return
	}
	path := filepath.Join(s.extrasSourceDir(extra), extra.File)
	data, err := readLimited(path)
	if err != nil && !os.IsNotExist(err) {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]any{"name": name, "path": path, "exists": err == nil, "content": string(data)})
}

// handlePutSharedInstructionsContent — PUT /api/instructions/{name}/content
func (s *Server) handlePutSharedInstructionsContent(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	name := r.PathValue("name")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxInstructionsBytes+4096)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	extra, ok := s.sharedExtra(name)
	if !ok {
		writeError(w, http.StatusNotFound, "shared instruction file not found: "+name)
		return
	}
	path := filepath.Join(s.extrasSourceDir(extra), extra.File)
	if err := writeInstructionsFile(path, body.Content); err != nil {
		s.writeOpsLog("instructions-edit", "error", start, map[string]any{"name": name, "scope": "ui"}, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-edit", "ok", start, map[string]any{"name": name, "path": path, "scope": "ui"}, "")
	writeJSON(w, map[string]any{"success": true, "path": path})
}

// assignTarget attaches exactly want to the named target. Callers must hold
// s.mu and save the config afterwards.
func (s *Server) assignTarget(name string, want []string) error {
	tc, found := s.cfg.Targets[name]
	if !found {
		return fmt.Errorf("target not found: %s", name)
	}
	it, ok := config.TargetInstructions(name, tc, false)
	if !ok {
		return fmt.Errorf("%s has no global instruction file", name)
	}
	if _, linked := s.cfg.Targets[it.SameAs]; linked {
		return fmt.Errorf("%s reads the same file as %s; change %s instead", name, it.SameAs, it.SameAs)
	}
	extras, err := instructions.Assign(s.cfg.Extras, instructions.Target{Name: name, File: it.Path, Import: it.Import}, want, s.instructionsResolver())
	s.cfg.Extras = extras
	return err
}

// handleAssignSharedInstructions — POST /api/instructions/assign
// Sets which shared files each listed target uses; an empty list restores the
// targets' own files.
func (s *Server) handleAssignSharedInstructions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var body struct {
		Targets []string `json:"targets"`
		Extras  []string `json:"extras"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(body.Targets) == 0 {
		writeError(w, http.StatusBadRequest, "at least one target is required")
		return
	}
	if body.Extras == nil {
		body.Extras = []string{}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	errs := []string{}
	for _, name := range body.Targets {
		if err := s.assignTarget(name, body.Extras); err != nil {
			errs = append(errs, err.Error())
		}
	}
	s.saveSharedAfterChange(w, start, "instructions-assign", map[string]any{"targets": body.Targets, "extras": body.Extras, "scope": "ui"}, errs)
}

// saveSharedAfterChange saves the config (files on disk already changed),
// logs, and answers with the per-target errors.
func (s *Server) saveSharedAfterChange(w http.ResponseWriter, start time.Time, cmd string, args map[string]any, errs []string) {
	if err := s.saveAndReloadConfig(); err != nil {
		errs = append(errs, err.Error())
	}
	status, msg := "ok", ""
	if len(errs) > 0 {
		status, msg = "partial", fmt.Sprint(errs)
	}
	s.writeOpsLog(cmd, status, start, args, msg)
	writeJSON(w, map[string]any{"success": len(errs) == 0, "errors": errs})
}

// handleRestoreSharedInstructions — POST /api/instructions/{name}/restore
// Detaches the shared file from one target and puts back what it replaced.
func (s *Server) handleRestoreSharedInstructions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	name := r.PathValue("name")
	var body struct {
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Target == "" {
		writeError(w, http.StatusBadRequest, "target is required")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	it, _, ok := s.targetInstructions(body.Target)
	if !ok {
		writeError(w, http.StatusBadRequest, body.Target+" has no instruction file")
		return
	}
	var keep []string
	for _, a := range instructions.Assignments(s.cfg.Extras, it.Path, s.instructionsResolver()) {
		if a.Name != name {
			keep = append(keep, a.Name)
		}
	}
	var errs []string
	if err := s.assignTarget(body.Target, keep); err != nil {
		errs = append(errs, err.Error())
	}
	s.saveSharedAfterChange(w, start, "instructions-restore", map[string]any{"name": name, "target": body.Target, "scope": "ui"}, errs)
}

// handleResolveSharedInstructions — POST /api/instructions/{name}/resolve
// Settles a target whose linked file was replaced and edited: collect writes
// the target's content back to the shared file; reapply backs the target up
// and links it again.
func (s *Server) handleResolveSharedInstructions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	name := r.PathValue("name")
	var body struct {
		Target string `json:"target"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Target == "" {
		writeError(w, http.StatusBadRequest, "target is required")
		return
	}
	if !slices.Contains([]string{"collect", "reapply"}, body.Action) {
		writeError(w, http.StatusBadRequest, "action must be collect or reapply")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	it, _, ok := s.targetInstructions(body.Target)
	if !ok {
		writeError(w, http.StatusBadRequest, body.Target+" has no instruction file")
		return
	}
	res := s.instructionsResolver()
	i, j := instructions.Find(s.cfg.Extras, name, it.Path, res)
	if j == -1 {
		writeError(w, http.StatusNotFound, name+" is not attached to "+body.Target)
		return
	}
	f := instructions.ExtraFile(s.cfg.Extras[i], j, res)
	var err error
	if body.Action == "collect" {
		err = syncpkg.CollectBackExtraFile(f, "")
	} else {
		err = syncpkg.ReapplyExtraFile(f, "")
	}
	args := map[string]any{"name": name, "target": body.Target, "action": body.Action, "scope": "ui"}
	if err != nil {
		s.writeOpsLog("instructions-resolve", "error", start, args, err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeOpsLog("instructions-resolve", "ok", start, args, "")
	writeJSON(w, map[string]any{"success": true})
}
