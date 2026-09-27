package instructions

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"skillshare/internal/config"
	syncpkg "skillshare/internal/sync"
)

// Target is a target's global instruction file, the unit shared files attach to.
type Target struct {
	Name   string
	File   string // absolute path
	Import bool   // several shared files can attach, each as an @path line
}

// Resolver locates the files of extras: the source directory of an extra and
// the directory a configured target path means.
type Resolver struct {
	SourceDir func(config.ExtraConfig) string
	TargetDir func(string) string
}

// Assign makes want exactly the shared files attached to t, in that order of
// addition. Files no longer wanted are restored first (their link or import
// line removed, the replaced file put back); newly wanted ones are added to
// the extra's targets and synced. A target without import takes at most one.
// It returns the updated extras; on error the extras reflect the steps done.
func Assign(extras []config.ExtraConfig, t Target, want []string, r Resolver) ([]config.ExtraConfig, error) {
	if !t.Import && len(want) > 1 {
		return extras, fmt.Errorf("%s can use only one shared instruction file", t.Name)
	}
	for _, name := range want {
		if i := indexOf(extras, name); i == -1 || extras[i].File == "" {
			return extras, fmt.Errorf("shared instruction file %q not found", name)
		}
	}

	var errs []string
	for i := range extras {
		if extras[i].File == "" || slices.Contains(want, extras[i].Name) {
			continue
		}
		j := targetIndex(extras[i], t.File, r)
		if j == -1 {
			continue
		}
		tc := extras[i].Targets[j]
		f := syncpkg.NewExtraFile(r.SourceDir(extras[i]), extras[i].File, r.TargetDir(tc.Path), tc.As, tc.Mode)
		if _, err := syncpkg.RestoreExtraTarget(f); err != nil {
			errs = append(errs, err.Error())
			continue
		}
		extras[i].Targets = slices.Delete(extras[i].Targets, j, j+1)
	}
	if len(errs) > 0 {
		return extras, fmt.Errorf("could not restore %s: %s", t.Name, strings.Join(errs, "; "))
	}

	for _, name := range want {
		i := indexOf(extras, name)
		if targetIndex(extras[i], t.File, r) != -1 {
			continue
		}
		tc := config.ExtraTargetConfig{Path: filepath.Dir(t.File), Mode: "symlink"}
		if t.Import {
			tc.Mode = "import"
		}
		if base := filepath.Base(t.File); base != extras[i].File {
			tc.As = base
		}
		if err := config.ValidateExtraConfig(config.ExtraConfig{Name: name, File: extras[i].File, Targets: []config.ExtraTargetConfig{tc}}); err != nil {
			return extras, err
		}
		f := syncpkg.NewExtraFile(r.SourceDir(extras[i]), extras[i].File, r.TargetDir(tc.Path), tc.As, tc.Mode)
		if _, err := syncpkg.SyncExtraFile(f, false, ""); err != nil {
			return extras, fmt.Errorf("attach %s to %s: %w", name, t.Name, err)
		}
		extras[i].Targets = append(extras[i].Targets, tc)
	}
	return extras, nil
}

// Find returns the index of the named single-file extra's target that writes
// file, or -1.
func Find(extras []config.ExtraConfig, name, file string, r Resolver) (int, int) {
	i := indexOf(extras, name)
	if i == -1 || extras[i].File == "" {
		return -1, -1
	}
	return i, targetIndex(extras[i], file, r)
}

// ExtraFile returns the sync view of an extra's j-th target.
func ExtraFile(extra config.ExtraConfig, j int, r Resolver) syncpkg.ExtraFile {
	tc := extra.Targets[j]
	return syncpkg.NewExtraFile(r.SourceDir(extra), extra.File, r.TargetDir(tc.Path), tc.As, tc.Mode)
}

func indexOf(extras []config.ExtraConfig, name string) int {
	for i := range extras {
		if extras[i].Name == name {
			return i
		}
	}
	return -1
}

func targetIndex(extra config.ExtraConfig, file string, r Resolver) int {
	for j := range extra.Targets {
		if samePath(ExtraFile(extra, j, r).Target, file) {
			return j
		}
	}
	return -1
}
