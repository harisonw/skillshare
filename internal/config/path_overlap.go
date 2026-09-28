package config

import "path/filepath"

// DetectPathOverlap returns the set of target names whose configured skill
// paths overlap with another enabled target — either by sharing the same
// primary path or by being scanned via cross-runtime discovery (also_scans).
//
// Used by `sync` (CLI hint) and the Web UI sync handler to surface a brief
// warning that points users at `doctor` for the full breakdown.
func DetectPathOverlap(targets map[string]TargetConfig, isProject bool) []string {
	if len(targets) < 2 {
		return nil
	}

	primaryByName := make(map[string]string, len(targets))
	for name, target := range targets {
		raw := target.SkillsConfig().Path
		if raw == "" {
			continue
		}
		primaryByName[name] = filepath.Clean(ExpandPath(raw))
	}

	writersByPath := make(map[string][]string, len(primaryByName))
	for name, p := range primaryByName {
		writersByPath[p] = append(writersByPath[p], name)
	}

	involved := make(map[string]struct{})
	for _, names := range writersByPath {
		if len(names) < 2 {
			continue
		}
		for _, n := range names {
			involved[n] = struct{}{}
		}
	}

	for scanner := range primaryByName {
		for _, p := range RuntimeScanPaths(scanner, isProject) {
			resolved := filepath.Clean(p)
			if resolved == primaryByName[scanner] {
				// The scanner's own write path — the shared-primary pass above
				// already covers anyone else writing there.
				continue
			}
			writers, ok := writersByPath[resolved]
			if !ok {
				continue
			}
			for _, w := range writers {
				if w == scanner {
					continue
				}
				involved[scanner] = struct{}{}
				involved[w] = struct{}{}
			}
		}
	}

	if len(involved) == 0 {
		return nil
	}

	out := make([]string, 0, len(involved))
	for n := range involved {
		out = append(out, n)
	}
	return out
}

// SkillsPathKeptBy returns a target, other than name and those in leaving, that
// writes to the same skills folder as name, or "" when none does. Removing name
// must then leave the folder alone: its links are that target's too.
func SkillsPathKeptBy(targets map[string]TargetConfig, name string, leaving map[string]bool) string {
	self := targets[name]
	raw := self.SkillsConfig().Path
	if raw == "" {
		return ""
	}
	path := filepath.Clean(ExpandPath(raw))
	for other, target := range targets {
		if other == name || leaving[other] || target.SkillsConfig().Path == "" {
			continue
		}
		if filepath.Clean(ExpandPath(target.SkillsConfig().Path)) == path {
			return other
		}
	}
	return ""
}
