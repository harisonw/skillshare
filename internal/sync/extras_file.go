package sync

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"skillshare/internal/config"
)

// Managed import block markers. Claude strips block-level HTML comments before
// loading context, so the markers cost nothing there.
const (
	importBlockBegin = "<!-- skillshare:instructions:begin -->"
	importBlockEnd   = "<!-- skillshare:instructions:end -->"
)

// ExtraFile is one target of a single-file extra (an extra with file: set).
type ExtraFile struct {
	Source string // absolute path of <source dir>/<file>
	Target string // <target path>/<as or file>
	Mode   string // merge (default), symlink, copy, or import
}

// NewExtraFile resolves the source and target files of a single-file extra.
// merge and symlink both link the one file.
func NewExtraFile(sourceDir, file, targetDir, as, mode string) ExtraFile {
	if as == "" {
		as = file
	}
	src := filepath.Join(sourceDir, file)
	if abs, err := filepath.Abs(src); err == nil {
		src = abs
	}
	return ExtraFile{Source: src, Target: filepath.Join(targetDir, as), Mode: EffectiveMode(mode)}
}

// DiscoverExtraSource returns the source files of an extra relative to
// sourceDir: the single file when file is set, otherwise every file under the
// directory (DiscoverExtraFiles).
func DiscoverExtraSource(sourceDir, file string) ([]string, error) {
	if file == "" {
		return DiscoverExtraFiles(sourceDir)
	}
	path := filepath.Join(sourceDir, file)
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("extras source file does not exist: %s", path)
		}
		return nil, fmt.Errorf("failed to stat extras source: %w", err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("extras source file is a directory: %s", path)
	}
	return []string{file}, nil
}

func (f ExtraFile) sourceExists() bool {
	info, err := os.Stat(f.Source)
	return err == nil && !info.IsDir()
}

// isOurLink reports whether target is a symlink pointing at the source file.
func (f ExtraFile) isOurLink() bool {
	dest, err := os.Readlink(f.Target)
	return err == nil && filepath.Clean(resolveReadlink(dest, f.Target)) == filepath.Clean(f.Source)
}

// SyncExtraFile writes one single-file extra target. A real target file that
// differs from the source is backed up and replaced without --force: on first
// attach it becomes the restore point, afterwards it is an edit and goes to
// the drift backups. A directory in the way is skipped. import mode maintains a managed @<source>
// line instead of replacing the file.
func SyncExtraFile(f ExtraFile, dryRun bool, projectRoot string) (*ExtraResult, error) {
	if !f.sourceExists() {
		return nil, fmt.Errorf("extras source file does not exist: %s", f.Source)
	}
	switch f.Mode {
	case "import":
		return syncExtraImport(f, dryRun)
	case "merge", "symlink", "copy":
		return syncExtraFileReplace(f, dryRun, projectRoot)
	default:
		return nil, fmt.Errorf("unsupported extras sync mode: %q", f.Mode)
	}
}

func syncExtraFileReplace(f ExtraFile, dryRun bool, projectRoot string) (*ExtraResult, error) {
	result := &ExtraResult{}
	relative := shouldUseRelative(projectRoot, f.Source, f.Target)
	copyMode := f.Mode == "copy"
	attached := extraAttached(f.Target)

	info, err := os.Lstat(f.Target)
	switch {
	case os.IsNotExist(err):
	case err != nil:
		return nil, fmt.Errorf("failed to inspect target: %w", err)
	case info.Mode()&os.ModeSymlink != 0:
		if !copyMode && f.isOurLink() {
			dest, _ := os.Readlink(f.Target)
			if linkNeedsReformat(dest, relative) && !dryRun {
				if err := reformatLink(f.Target, f.Source, relative); err != nil {
					return nil, fmt.Errorf("failed to reformat symlink: %w", err)
				}
			}
			result.Synced = 1
			return result, nil
		}
		// Any other symlink is left over from a mode change, or, on first
		// attach, the user's own link: record it so restore can put it back.
		if !dryRun {
			if !attached && !f.isOurLink() {
				if err := recordExtraRestoreLink(f.Target); err != nil {
					return nil, err
				}
				attached = true
			}
			if err := os.Remove(f.Target); err != nil {
				return nil, fmt.Errorf("failed to remove conflicting symlink: %w", err)
			}
		}
	case info.IsDir():
		result.Skipped = 1
		result.Warnings = append(result.Warnings, fmt.Sprintf("%s is a directory; not replaced", f.Target))
		return result, nil
	default:
		same := contentEqual(f.Source, f.Target)
		if copyMode && same {
			result.Synced = 1
			return result, nil
		}
		if !dryRun {
			// On first attach, back up even an identical file: restoring the
			// target later has nothing else to put back once the link is
			// removed. Once attached, a differing file is an edit; keep it as
			// a drift backup so the restore point stays the pre-attach state.
			if !attached {
				if err := recordExtraRestorePoint(f.Target, f.importLine()); err != nil {
					return nil, err
				}
				attached = true
			} else if !same {
				if err := backupExtraDrift(f.Target); err != nil {
					return nil, err
				}
			}
			if !same {
				result.Warnings = append(result.Warnings, fmt.Sprintf("backed up %s before replacing it", f.Target))
			}
			if err := os.Remove(f.Target); err != nil {
				return nil, fmt.Errorf("failed to remove existing file: %w", err)
			}
		}
	}

	if dryRun {
		result.Synced = 1
		return result, nil
	}
	if err := os.MkdirAll(filepath.Dir(f.Target), 0755); err != nil {
		return nil, fmt.Errorf("failed to create parent dir: %w", err)
	}
	if copyMode {
		if err := copyFile(f.Source, f.Target); err != nil {
			return nil, fmt.Errorf("failed to copy file: %w", err)
		}
	} else if err := createLink(f.Target, f.Source, relative); err != nil {
		return nil, fmt.Errorf("failed to create symlink: %w", err)
	}
	if !attached {
		if err := markExtraCreated(f.Target); err != nil {
			return nil, fmt.Errorf("failed to record created file: %w", err)
		}
	}
	result.Synced = 1
	return result, nil
}

func (f ExtraFile) importLine() string { return "@" + f.Source }

// ImportLine is the @path line import mode keeps in the target file.
func (f ExtraFile) ImportLine() string { return f.importLine() }

// AddManagedImport adds line to content's managed import block, as import mode
// does, and reports whether content changed.
func AddManagedImport(content, line string) (string, bool) { return addImportLine(content, line) }

// ManagedImportLines returns the 0-based indexes of the lines of content that
// belong to the managed import block, markers included.
func ManagedImportLines(content string) []int {
	lines := strings.Split(content, "\n")
	begin, end := findImportBlock(lines)
	var out []int
	for i := begin; begin != -1 && i <= end; i++ {
		out = append(out, i)
	}
	return out
}

// BackupFile saves the current content of path to the extras backup history
// before skillshare rewrites or removes it.
func BackupFile(path string) error { return backupExtraFile(path) }

func syncExtraImport(f ExtraFile, dryRun bool) (*ExtraResult, error) {
	result := &ExtraResult{Synced: 1}

	// A link to the source is left over from symlink mode; writing through it
	// would edit the source, so drop it and start a new file.
	ourLink := f.isOurLink()
	if ourLink && !dryRun {
		if err := os.Remove(f.Target); err != nil {
			return nil, fmt.Errorf("failed to remove leftover symlink: %w", err)
		}
	}
	// An attached copy of the source is left over from copy mode; replace it
	// rather than keep it, so restore can put back the attach-time state.
	leftoverCopy := !ourLink && extraAttached(f.Target) && contentEqual(f.Source, f.Target)

	data, err := os.ReadFile(f.Target)
	created := os.IsNotExist(err) || ourLink || leftoverCopy
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("failed to read target: %w", err)
	}
	if created {
		data = nil
	}
	updated, changed := addImportLine(string(data), f.importLine())
	if !changed || dryRun {
		return result, nil
	}

	perm := os.FileMode(0644)
	if info, statErr := os.Stat(f.Target); statErr == nil {
		perm = info.Mode().Perm()
	}
	if err := os.MkdirAll(filepath.Dir(f.Target), 0755); err != nil {
		return nil, fmt.Errorf("failed to create parent dir: %w", err)
	}
	if err := os.WriteFile(f.Target, []byte(updated), perm); err != nil {
		return nil, fmt.Errorf("failed to write target: %w", err)
	}
	// A switch from another mode keeps the restore point recorded then.
	if created && !extraAttached(f.Target) {
		if err := markExtraCreated(f.Target); err != nil {
			return nil, fmt.Errorf("failed to record created file: %w", err)
		}
	}
	return result, nil
}

// findImportBlock returns the line indexes of the managed block markers, or
// (-1, -1) when the block is absent.
func findImportBlock(lines []string) (begin, end int) {
	begin = -1
	for i, l := range lines {
		switch strings.TrimSpace(l) {
		case importBlockBegin:
			if begin == -1 {
				begin = i
			}
		case importBlockEnd:
			if begin != -1 {
				return begin, i
			}
		}
	}
	return -1, -1
}

func hasImportLine(content, line string) bool {
	lines := strings.Split(content, "\n")
	begin, end := findImportBlock(lines)
	for i := begin + 1; begin != -1 && i < end; i++ {
		if strings.TrimSpace(lines[i]) == line {
			return true
		}
	}
	return false
}

// addImportLine appends line to the managed block, creating the block at the
// top of content when absent. Content outside the block is never changed.
func addImportLine(content, line string) (string, bool) {
	if hasImportLine(content, line) {
		return content, false
	}
	lines := strings.Split(content, "\n")
	if _, end := findImportBlock(lines); end != -1 {
		lines = append(lines[:end], append([]string{line}, lines[end:]...)...)
		return strings.Join(lines, "\n"), true
	}
	block := importBlockBegin + "\n" + line + "\n" + importBlockEnd + "\n"
	if content == "" {
		return block, true
	}
	return block + "\n" + content, true
}

// removeImportLine deletes line from the managed block and drops the block
// (with the blank line addImportLine put after it) once it is empty.
func removeImportLine(content, line string) (string, bool) {
	if !hasImportLine(content, line) {
		return content, false
	}
	lines := strings.Split(content, "\n")
	begin, end := findImportBlock(lines)
	var kept []string
	for _, l := range lines[begin+1 : end] {
		if strings.TrimSpace(l) != line {
			kept = append(kept, l)
		}
	}
	empty := true
	for _, l := range kept {
		if strings.TrimSpace(l) != "" {
			empty = false
		}
	}
	var out []string
	out = append(out, lines[:begin]...)
	rest := lines[end+1:]
	if empty {
		if len(rest) > 0 && strings.TrimSpace(rest[0]) == "" && len(rest) > 1 {
			rest = rest[1:]
		}
	} else {
		out = append(out, lines[begin])
		out = append(out, kept...)
		out = append(out, lines[end])
	}
	out = append(out, rest...)
	return strings.Join(out, "\n"), true
}

// ExtraFileStatus reports "synced", "drift", "modified" (a symlink-mode
// target was replaced by a different real file), "not synced" (no target
// file), or "no source".
func ExtraFileStatus(f ExtraFile) string {
	if !f.sourceExists() {
		return "no source"
	}
	if _, err := os.Lstat(f.Target); os.IsNotExist(err) {
		return "not synced"
	}
	if f.Mode == "import" {
		data, err := os.ReadFile(f.Target)
		if err == nil && !f.isOurLink() && hasImportLine(string(data), f.importLine()) {
			return "synced"
		}
		return "drift"
	}
	info, err := os.Lstat(f.Target)
	if err != nil {
		return "drift"
	}
	if f.Mode == "copy" {
		if info.Mode().IsRegular() && contentEqual(f.Source, f.Target) {
			return "synced"
		}
		return "drift"
	}
	if info.Mode()&os.ModeSymlink != 0 {
		if f.isOurLink() {
			return "synced"
		}
		return "drift"
	}
	if info.Mode().IsRegular() && !contentEqual(f.Source, f.Target) {
		return "modified"
	}
	return "drift"
}

// RestoreExtraTarget undoes a single-file extra target when it is removed. It
// removes what skillshare wrote (its symlink, a copy, or its import line) and
// puts back the state recorded at attach time: the file it replaced, or no
// file. An attached target the user edited is saved as a drift backup first.
// A file skillshare never attached to is left alone. It reports whether
// anything was changed.
func RestoreExtraTarget(f ExtraFile) (bool, error) {
	if f.Mode == "import" {
		return restoreExtraImport(f)
	}

	info, err := os.Lstat(f.Target)
	switch {
	case os.IsNotExist(err):
	case err != nil:
		return false, fmt.Errorf("failed to inspect target: %w", err)
	case f.isOurLink(), f.Mode == "copy" && info.Mode().IsRegular() && contentEqual(f.Source, f.Target):
		if err := os.Remove(f.Target); err != nil {
			return false, fmt.Errorf("failed to remove target: %w", err)
		}
	case info.Mode().IsRegular() && extraAttached(f.Target):
		if err := backupExtraDrift(f.Target); err != nil {
			return false, err
		}
		if err := os.Remove(f.Target); err != nil {
			return false, fmt.Errorf("failed to remove modified target: %w", err)
		}
	default:
		// Not ours to undo; the target is being detached all the same.
		clearExtraAttach(f.Target)
		return false, nil
	}

	return true, putBackExtraRestorePoint(f.Target)
}

func restoreExtraImport(f ExtraFile) (bool, error) {
	data, err := os.ReadFile(f.Target)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to read target: %w", err)
	}
	updated, changed := removeImportLine(string(data), f.importLine())
	if !changed {
		return false, nil
	}
	// Only the managed block was left: the file is what skillshare wrote, so
	// put back the state recorded at attach time (no file, or the replaced one).
	if strings.TrimSpace(updated) == "" && extraAttached(f.Target) {
		if err := os.Remove(f.Target); err != nil {
			return false, fmt.Errorf("failed to remove target: %w", err)
		}
		return true, putBackExtraRestorePoint(f.Target)
	}
	info, err := os.Stat(f.Target)
	if err != nil {
		return false, err
	}
	if err := os.WriteFile(f.Target, []byte(updated), info.Mode().Perm()); err != nil {
		return false, fmt.Errorf("failed to write target: %w", err)
	}
	return true, nil
}

// CollectBackExtraFile resolves a "modified" target by keeping the target's
// content: it becomes the source (the old source is backed up), then the
// target is linked again. In copy mode the target stays a copy.
func CollectBackExtraFile(f ExtraFile, projectRoot string) error {
	info, err := os.Lstat(f.Target)
	if err != nil {
		return fmt.Errorf("failed to inspect target: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("target %s is not a regular file", f.Target)
	}
	data, err := os.ReadFile(f.Target)
	if err != nil {
		return fmt.Errorf("failed to read target: %w", err)
	}
	perm := os.FileMode(0644)
	if srcInfo, statErr := os.Stat(f.Source); statErr == nil {
		existing, _ := os.ReadFile(f.Source)
		if !bytes.Equal(existing, data) {
			if err := backupExtraFile(f.Source); err != nil {
				return err
			}
		}
		perm = srcInfo.Mode().Perm()
	}
	if err := os.MkdirAll(filepath.Dir(f.Source), 0755); err != nil {
		return fmt.Errorf("failed to create source dir: %w", err)
	}
	if err := os.WriteFile(f.Source, data, perm); err != nil {
		return fmt.Errorf("failed to write source: %w", err)
	}
	return replaceDriftedTarget(f, projectRoot)
}

// ReapplyExtraFile resolves a "modified" target by keeping the source: the
// target file is backed up and replaced by the source again.
func ReapplyExtraFile(f ExtraFile, projectRoot string) error {
	return replaceDriftedTarget(f, projectRoot)
}

// replaceDriftedTarget links a modified target back to its source. The edited
// file is kept as a drift backup, not a regular one: a later restore must put
// back what was there before the target was attached, not the edit.
func replaceDriftedTarget(f ExtraFile, projectRoot string) error {
	if info, err := os.Lstat(f.Target); err == nil && info.Mode().IsRegular() {
		if err := backupExtraDrift(f.Target); err != nil {
			return err
		}
		if err := os.Remove(f.Target); err != nil {
			return fmt.Errorf("failed to remove modified target: %w", err)
		}
	}
	result, err := SyncExtraFile(f, false, projectRoot)
	if err != nil {
		return err
	}
	if result.Skipped > 0 {
		return fmt.Errorf("%s", strings.Join(result.Warnings, "; "))
	}
	return nil
}

// RestoreExtraFileTargets undoes every target of a removed single-file extra:
// its links, copies, or import lines go, and files it replaced come back.
// resolve turns a configured target path into a directory. Directory extras
// are left alone (sync cleans their orphans). It reports how many targets
// changed.
func RestoreExtraFileTargets(extra config.ExtraConfig, sourceDir string, resolve func(string) string) (int, error) {
	if extra.File == "" {
		return 0, nil
	}
	restored := 0
	var errs []string
	for _, t := range extra.Targets {
		changed, err := RestoreExtraTarget(NewExtraFile(sourceDir, extra.File, resolve(t.Path), t.As, t.Mode))
		if err != nil {
			errs = append(errs, err.Error())
		}
		if changed {
			restored++
		}
	}
	if len(errs) > 0 {
		return restored, fmt.Errorf("removed %q but could not restore targets: %s", extra.Name, strings.Join(errs, "; "))
	}
	return restored, nil
}

// ForgetExtraTarget drops the attach-time record of a target that is detached
// from the config without being restored, so a later attach records afresh.
func ForgetExtraTarget(f ExtraFile) { clearExtraAttach(f.Target) }
