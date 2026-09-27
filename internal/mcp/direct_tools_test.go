package mcp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDirectToolsRenderedOnlyForPiAdapter(t *testing.T) {
	server := Server{Command: "echo", PiExtension: "pi-mcp-adapter", DirectTools: []any{"search", "fetch"}}
	out, err := Render("pi", server)
	if err != nil {
		t.Fatal(err)
	}
	if list, ok := out["directTools"].([]any); !ok || len(list) != 2 {
		t.Fatalf("pi entry: %v", out)
	}
	out, err = Render("opencode", server)
	if err != nil || out["directTools"] != nil {
		t.Fatalf("directTools leaked into another Agent: %v %v", out, err)
	}
}

func TestDirectToolsRejected(t *testing.T) {
	adapter := "pi-mcp-adapter"
	for name, server := range map[string]Server{
		"number":          {Command: "echo", PiExtension: adapter, DirectTools: 3},
		"unknown keyword": {Command: "echo", PiExtension: adapter, DirectTools: "all"},
		"empty tool name": {Command: "echo", PiExtension: adapter, DirectTools: []any{""}},
		"other extension": {Command: "echo", PiExtension: "pi-mcp-extension", DirectTools: true},
		"no extension":    {Command: "echo", DirectTools: true},
		"switch only":     {Disabled: true, PiExtension: adapter, DirectTools: true},
	} {
		if err := server.Validate("docs"); err == nil || !strings.Contains(err.Error(), "directTools") {
			t.Errorf("%s: got %v", name, err)
		}
	}
	for name, value := range map[string]any{"true": true, "false": false, "search": "search", "names": []any{"a"}} {
		if err := (Server{Command: "echo", PiExtension: adapter, DirectTools: value}).Validate("docs"); err != nil {
			t.Errorf("%s rejected: %v", name, err)
		}
	}
}

func TestDirectToolsSyncFollowsConfigAndKeepsHandAddedValue(t *testing.T) {
	s := testService(t)
	path := filepath.Join(s.Home, ".pi", "agent", "mcp-adapter.json")
	sync := func(directTools, wantAction string) string {
		t.Helper()
		config := "mcp:\n  targets: [pi]\n  servers:\n    docs:\n      command: docs\n      piExtension: pi-mcp-adapter\n" + directTools
		if err := os.WriteFile(s.ConfigPath, []byte(config), 0600); err != nil {
			t.Fatal(err)
		}
		plan, err := s.Preview()
		if err != nil || plan.Blocked || plan.Changes[0].Action != wantAction {
			t.Fatalf("want %s, got %+v %v", wantAction, plan, err)
		}
		if _, err := s.Apply(plan.Revision); err != nil {
			t.Fatal(err)
		}
		data, _ := os.ReadFile(path)
		return string(data)
	}
	sync("", "add")
	// A value added by hand before Skillshare could set it must not become a conflict.
	data, _ := os.ReadFile(path)
	if err := os.WriteFile(path, []byte(strings.Replace(string(data), `"command"`, `"directTools": true, "command"`, 1)), 0600); err != nil {
		t.Fatal(err)
	}
	if got := sync("", "unchanged"); !strings.Contains(got, `"directTools": true`) {
		t.Fatalf("hand-added value lost: %s", got)
	}
	if got := sync("      directTools: [search]\n", "update"); !strings.Contains(got, `"search"`) || strings.Contains(got, `"directTools": true`) {
		t.Fatalf("config value not written: %s", got)
	}
	sync("      directTools: [search]\n", "unchanged")
}

func TestDirectToolsImportedFromPi(t *testing.T) {
	candidates, err := Import("pi", []byte(`{"mcpServers":{"docs":{"command":"docs","directTools":["search"]}}}`), "")
	if err != nil || len(candidates) != 1 {
		t.Fatalf("%+v %v", candidates, err)
	}
	if list, ok := candidates[0].Server.DirectTools.([]any); !ok || len(list) != 1 {
		t.Fatalf("not imported: %+v", candidates[0])
	}
	for _, warning := range candidates[0].Warnings {
		if strings.Contains(warning, "directTools") {
			t.Fatalf("still reported as not imported: %s", warning)
		}
	}
}

func TestDirectToolsDefaultFillsPiServersWithoutTheirOwn(t *testing.T) {
	s, tmp := projectsService(t, `mcp:
  targets: [pi, opencode]
  directTools: true
  servers:
    inherits:
      command: a
      piExtension: pi-mcp-adapter
    own:
      command: b
      piExtension: pi-mcp-adapter
      directTools: [search]
  projects:
    $TMP/quiet:
      directTools: false
      servers:
        local:
          command: c
          piExtension: pi-mcp-adapter
          targets: [pi]
    $TMP/same:
      servers:
        local:
          command: d
          piExtension: pi-mcp-adapter
          targets: [pi]
`)
	source, err := LoadSource(s.ConfigPath)
	if err != nil {
		t.Fatal(err)
	}
	desired, err := s.render(source)
	if err != nil {
		t.Fatal(err)
	}
	global := desired[fileKey{filepath.Join(tmp, ".pi", "agent", "mcp-adapter.json"), "pi"}]
	if global["inherits"]["directTools"] != true {
		t.Errorf("default not applied: %v", global["inherits"])
	}
	if list, ok := global["own"]["directTools"].([]any); !ok || len(list) != 1 {
		t.Errorf("server value lost to the default: %v", global["own"])
	}
	if got := desired[fileKey{filepath.Join(tmp, "quiet", ".pi", "mcp-adapter.json"), "pi"}]["local"]["directTools"]; got != false {
		t.Errorf("project default ignored: %v", got)
	}
	if got := desired[fileKey{filepath.Join(tmp, "same", ".pi", "mcp-adapter.json"), "pi"}]["local"]["directTools"]; got != true {
		t.Errorf("project did not inherit the global default: %v", got)
	}
	if _, leaked := desired[fileKey{filepath.Join(tmp, ".config", "opencode", "opencode.json"), "opencode"}]["inherits"]["directTools"]; leaked {
		t.Error("default leaked into another Agent")
	}
}

func TestDirectToolsDefaultRejectsBadValue(t *testing.T) {
	s, _ := projectsService(t, "mcp:\n  directTools: all\n")
	if _, err := s.Preview(); err == nil || !strings.Contains(err.Error(), "directTools") {
		t.Fatalf("got %v", err)
	}
}

func TestDirectToolsDefaultShowsInTheDashboardPreview(t *testing.T) {
	s, _ := projectsService(t, "mcp:\n  targets: [pi]\n  directTools: search\n")
	got := s.RenderNative("docs", Server{Command: "docs", PiExtension: "pi-mcp-adapter", Targets: []string{"pi"}})
	if got[0].Error != "" || !strings.Contains(got[0].Content, `"directTools": "search"`) {
		t.Fatalf("preview left out the default sync would write: %+v", got[0])
	}
}
