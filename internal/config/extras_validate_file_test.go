package config

import (
	"strings"
	"testing"
)

func TestValidateExtraConfig_SingleFile(t *testing.T) {
	tests := []struct {
		name    string
		extra   ExtraConfig
		wantErr string
	}{
		{"directory extra", ExtraConfig{Name: "rules", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "copy"}}}, ""},
		{"file symlink", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "symlink", As: "CLAUDE.md"}}}, ""},
		{"file import", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "import"}}}, ""},
		{"file with separator", ExtraConfig{Name: "i", File: "a/AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t"}}}, "plain filename"},
		{"file dotdot", ExtraConfig{Name: "i", File: "..", Targets: []ExtraTargetConfig{{Path: "/t"}}}, "plain filename"},
		{"as with separator", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", As: "../CLAUDE.md"}}}, "plain filename"},
		{"as without file", ExtraConfig{Name: "i", Targets: []ExtraTargetConfig{{Path: "/t", As: "CLAUDE.md"}}}, "requires file"},
		{"import without file", ExtraConfig{Name: "i", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "import"}}}, "requires file"},
		{"flatten with file", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", Flatten: true}}}, "flatten"},
		{"extension with import", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "import", Extension: "x"}}}, "extension"},
		{"extension with single-file copy", ExtraConfig{Name: "i", File: "AGENTS.md", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "copy", Extension: "x"}}}, "extension cannot be used with a single-file extra"},
		{"extension on directory extra", ExtraConfig{Name: "rules", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "copy", Extension: "x"}}}, ""},
		{"unknown mode", ExtraConfig{Name: "i", Targets: []ExtraTargetConfig{{Path: "/t", Mode: "bogus"}}}, "invalid mode"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateExtraConfig(tt.extra)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want containing %q", err, tt.wantErr)
			}
		})
	}
}

func TestValidSyncModes_SkillsRejectImport(t *testing.T) {
	if IsValidSyncMode("import") {
		t.Error("skills sync modes must not accept import")
	}
	if err := ValidateExtraMode("import"); err != nil {
		t.Errorf("extras mode import rejected: %v", err)
	}
}
