//go:build !online

package integration

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"skillshare/internal/testutil"
)

const (
	extrasImportBegin = "<!-- skillshare:instructions:begin -->"
	extrasImportEnd   = "<!-- skillshare:instructions:end -->"
)

// setupSingleFileExtra creates extras/<name>/<file> plus an unrelated file in
// the same source directory, and returns the source file path.
func setupSingleFileExtra(t *testing.T, sb *testutil.Sandbox, name, file, content string) string {
	t.Helper()
	dir := filepath.Join(filepath.Dir(sb.SourcePath), "extras", name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	sb.WriteFile(filepath.Join(dir, file), content)
	sb.WriteFile(filepath.Join(dir, "notes.md"), "not part of the extra")
	return filepath.Join(dir, file)
}

func singleFileConfig(sb *testutil.Sandbox, extras string) string {
	return "source: " + sb.SourcePath + "\ntargets:\n  claude:\n    path: " + sb.CreateTarget("claude") + "\nextras:\n" + extras
}

func extrasListStatuses(t *testing.T, sb *testutil.Sandbox) map[string]string {
	t.Helper()
	result := sb.RunCLI("extras", "list", "--json")
	result.AssertSuccess(t)
	var entries []struct {
		Name    string `json:"name"`
		Targets []struct {
			Status string `json:"status"`
		} `json:"targets"`
	}
	if err := json.Unmarshal([]byte(result.Stdout), &entries); err != nil {
		t.Fatalf("parse extras list: %v\n%s", err, result.Stdout)
	}
	statuses := map[string]string{}
	for _, e := range entries {
		for _, tg := range e.Targets {
			statuses[e.Name] = tg.Status
		}
	}
	return statuses
}

func TestExtrasFile_SymlinkWithAsAndCopy(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	src := setupSingleFileExtra(t, sb, "instructions", "AGENTS.md", "# shared")
	claudeDir := filepath.Join(sb.Home, ".claude")
	codexDir := filepath.Join(sb.Home, ".codex")
	sb.WriteConfig(singleFileConfig(sb, `  - name: instructions
    file: AGENTS.md
    targets:
      - path: `+claudeDir+`
        mode: symlink
        as: CLAUDE.md
      - path: `+codexDir+`
        mode: copy
`))

	sb.RunCLI("sync", "extras").AssertSuccess(t)

	if got := sb.SymlinkTarget(filepath.Join(claudeDir, "CLAUDE.md")); got != src {
		t.Errorf("CLAUDE.md link = %q, want %q", got, src)
	}
	if got := sb.ReadFile(filepath.Join(codexDir, "AGENTS.md")); got != "# shared" {
		t.Errorf("codex copy = %q", got)
	}
	if sb.FileExists(filepath.Join(claudeDir, "notes.md")) {
		t.Error("only the extra's file should be synced")
	}
	if got := extrasListStatuses(t, sb)["instructions"]; got != "synced" {
		t.Errorf("list status = %q, want synced", got)
	}
	diff := sb.RunCLI("diff", "--json")
	diff.AssertSuccess(t)
	if strings.Contains(diff.Stdout, "source directory not found") {
		t.Errorf("diff should understand single-file extras:\n%s", diff.Stdout)
	}
	sb.RunCLI("status").AssertSuccess(t)
}

func TestExtrasFile_ImportIdempotentAndRemoveKeepsOthers(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	srcA := setupSingleFileExtra(t, sb, "instructions", "AGENTS.md", "# shared")
	srcB := setupSingleFileExtra(t, sb, "team", "TEAM.md", "# team")
	claudeDir := filepath.Join(sb.Home, ".claude")
	claudeMD := filepath.Join(claudeDir, "CLAUDE.md")
	sb.WriteFile(claudeMD, "# My notes\n")
	sb.WriteConfig(singleFileConfig(sb, `  - name: instructions
    file: AGENTS.md
    targets:
      - path: `+claudeDir+`
        mode: import
        as: CLAUDE.md
  - name: team
    file: TEAM.md
    targets:
      - path: `+claudeDir+`
        mode: import
        as: CLAUDE.md
`))

	sb.RunCLI("sync", "extras").AssertSuccess(t)
	sb.RunCLI("sync", "extras").AssertSuccess(t)

	want := extrasImportBegin + "\n@" + srcA + "\n@" + srcB + "\n" + extrasImportEnd + "\n\n# My notes\n"
	if got := sb.ReadFile(claudeMD); got != want {
		t.Fatalf("CLAUDE.md =\n%s\nwant\n%s", got, want)
	}
	if got := extrasListStatuses(t, sb)["instructions"]; got != "synced" {
		t.Errorf("list status = %q, want synced", got)
	}

	sb.RunCLI("extras", "remove", "instructions", "--force").AssertSuccess(t)

	want = extrasImportBegin + "\n@" + srcB + "\n" + extrasImportEnd + "\n\n# My notes\n"
	if got := sb.ReadFile(claudeMD); got != want {
		t.Fatalf("after remove CLAUDE.md =\n%s\nwant\n%s", got, want)
	}
}

func TestExtrasFile_BackupThenReplaceAndRestore(t *testing.T) {
	for _, prior := range []bool{true, false} {
		name := "without prior file"
		if prior {
			name = "with prior file"
		}
		t.Run(name, func(t *testing.T) {
			sb := testutil.NewSandbox(t)
			defer sb.Cleanup()
			sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
			setupSingleFileExtra(t, sb, "instructions", "AGENTS.md", "# shared")
			claudeDir := filepath.Join(sb.Home, ".claude")
			claudeMD := filepath.Join(claudeDir, "CLAUDE.md")
			if prior {
				sb.WriteFile(claudeMD, "# original")
			}
			sb.WriteConfig(singleFileConfig(sb, `  - name: instructions
    file: AGENTS.md
    targets:
      - path: `+claudeDir+`
        as: CLAUDE.md
`))

			sb.RunCLI("sync", "extras").AssertSuccess(t)
			if !sb.IsSymlink(claudeMD) {
				t.Fatal("CLAUDE.md should be replaced by a symlink without --force")
			}

			sb.RunCLI("extras", "remove", "instructions", "--force").AssertSuccess(t)

			if prior {
				if sb.IsSymlink(claudeMD) || sb.ReadFile(claudeMD) != "# original" {
					t.Fatal("remove should restore the backed-up file")
				}
			} else if _, err := os.Lstat(claudeMD); !os.IsNotExist(err) {
				t.Fatal("remove should delete only the symlink skillshare created")
			}
		})
	}
}

func TestExtrasFile_ReattachAfterConfigOnlyRemoveTargetRestoresNewFile(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	setupSingleFileExtra(t, sb, "instructions", "AGENTS.md", "# shared")
	claudeDir := filepath.Join(sb.Home, ".claude")
	claudeMD := filepath.Join(claudeDir, "CLAUDE.md")
	otherDir := filepath.Join(sb.Home, ".other")
	sb.WriteFile(claudeMD, "v1")
	cfg := singleFileConfig(sb, `  - name: instructions
    file: AGENTS.md
    targets:
      - path: `+otherDir+`
      - path: `+claudeDir+`
        as: CLAUDE.md
`)
	sb.WriteConfig(cfg)
	sb.RunCLI("sync", "extras").AssertSuccess(t)

	sb.RunCLI("extras", "instructions", "--remove-target", claudeDir, "-g").AssertSuccess(t)
	os.Remove(claudeMD)
	sb.WriteFile(claudeMD, "v2")
	sb.WriteConfig(cfg)
	sb.RunCLI("sync", "extras").AssertSuccess(t)
	sb.RunCLI("extras", "remove", "instructions", "--force").AssertSuccess(t)

	if got := sb.ReadFile(claudeMD); got != "v2" {
		t.Errorf("CLAUDE.md = %q, want the file present at the second attach", got)
	}
}

func TestExtrasFile_ModifiedStatus(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	setupSingleFileExtra(t, sb, "instructions", "AGENTS.md", "# shared")
	claudeDir := filepath.Join(sb.Home, ".claude")
	claudeMD := filepath.Join(claudeDir, "CLAUDE.md")
	sb.WriteConfig(singleFileConfig(sb, `  - name: instructions
    file: AGENTS.md
    targets:
      - path: `+claudeDir+`
        mode: symlink
        as: CLAUDE.md
`))
	sb.RunCLI("sync", "extras").AssertSuccess(t)
	os.Remove(claudeMD)
	sb.WriteFile(claudeMD, "# edited in the tool")

	if got := extrasListStatuses(t, sb)["instructions"]; got != "modified" {
		t.Errorf("list status = %q, want modified", got)
	}
}

func TestExtrasFile_ImportRequiresFile(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	rules := filepath.Join(sb.Home, ".claude", "rules")
	sb.WriteConfig(singleFileConfig(sb, `  - name: rules
    targets:
      - path: `+rules+`
        mode: import
`))

	result := sb.RunCLI("sync")
	result.AssertFailure(t)
	result.AssertAnyOutputContains(t, "import mode requires file")
}

func TestExtrasFile_SkillsTargetRejectsImport(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	sb.WriteConfig("source: " + sb.SourcePath + "\ntargets:\n  claude:\n    path: " + sb.CreateTarget("claude") + "\n    mode: import\n")

	result := sb.RunCLI("sync")
	result.AssertFailure(t)
	result.AssertAnyOutputContains(t, "invalid sync mode")
}

func TestExtrasFile_InitRejectsImport(t *testing.T) {
	sb := testutil.NewSandbox(t)
	defer sb.Cleanup()
	sb.CreateSkill("placeholder", map[string]string{"SKILL.md": "# P"})
	sb.WriteConfig("source: " + sb.SourcePath + "\ntargets:\n  claude:\n    path: " + sb.CreateTarget("claude") + "\n")

	result := sb.RunCLI("extras", "init", "rules", "--target", filepath.Join(sb.Home, ".claude", "rules"), "--mode", "import")
	result.AssertFailure(t)
	result.AssertAnyOutputContains(t, "import mode requires a single-file extra")
}
