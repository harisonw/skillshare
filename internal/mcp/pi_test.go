package mcp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPiRender(t *testing.T) {
	for _, extension := range []string{"pi-mcp-adapter", "pi-mcp-extension"} {
		t.Run(extension, func(t *testing.T) {
			out, err := Render("pi", Server{URL: "https://example.com/mcp", PiExtension: extension})
			if err != nil {
				t.Fatal(err)
			}
			if out["url"] != "https://example.com/mcp" {
				t.Fatal(out)
			}
			if extension == "pi-mcp-extension" && out["transport"] != "streamable-http" {
				t.Fatal(out)
			}
			if extension == "pi-mcp-adapter" && out["transport"] != nil {
				t.Fatal(out)
			}
		})
	}
	if _, err := Render("pi", Server{Command: "echo"}); err == nil {
		t.Fatal("must choose extension")
	}
	if _, err := Render("pi", Server{URL: "https://example.com", PiExtension: "pi-mcp-extension", BearerToken: &Value{FromEnv: "TOKEN"}}); err == nil {
		t.Fatal("extension cannot interpolate headers")
	}
	out, err := Render("pi", Server{Command: "echo", PiExtension: "pi-mcp-adapter", Env: map[string]Value{"LITERAL": {Literal: "!date"}, "TOKEN": {FromEnv: "TOKEN"}}})
	if err != nil {
		t.Fatal(err)
	}
	env := out["env"].(map[string]string)
	if env["LITERAL"] != "!!date" || env["TOKEN"] != "${TOKEN}" {
		t.Fatal(env)
	}
}

func TestPiSyncScopesAndPreservation(t *testing.T) {
	for _, project := range []bool{false, true} {
		s := testService(t)
		if project {
			s.ProjectRoot = filepath.Join(s.Home, "project")
		}
		path := filepath.Join(s.Home, ".pi", "agent", "mcp.json")
		if project {
			path = filepath.Join(s.ProjectRoot, ".pi", "mcp.json")
		}
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		original := `{"settings":{"maxRetries":3},"mcpServers":{"mine":{"command":"mine"}}}`
		if err := os.WriteFile(path, []byte(original), 0600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(s.ConfigPath, []byte("mcp:\n  targets: [pi]\n  servers:\n    docs:\n      url: https://example.com/mcp\n      piExtension: pi-mcp-extension\n"), 0600); err != nil {
			t.Fatal(err)
		}
		p, err := s.Preview()
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.Apply(p.Revision); err != nil {
			t.Fatal(err)
		}
		data, _ := os.ReadFile(path)
		if !strings.Contains(string(data), `"mine"`) || !strings.Contains(string(data), `"maxRetries"`) || !strings.Contains(string(data), `"streamable-http"`) {
			t.Fatal(string(data))
		}
		p, err = s.Preview()
		if err != nil || p.Changes[0].Action != "unchanged" {
			t.Fatalf("%+v %v", p, err)
		}
	}
}

func TestPiImportTransportAndMixedExtensions(t *testing.T) {
	candidates, err := Import("pi", []byte(`{"mcpServers":{"docs":{"transport":"streamable-http","url":"https://example.com/mcp","lifecycle":"eager"}}}`), "")
	if err != nil || len(candidates) != 1 || len(candidates[0].Problems) != 0 || candidates[0].Server.Transport != "streamable-http" {
		t.Fatalf("%+v %v", candidates, err)
	}
	candidates, err = Import("pi", []byte(`{"mcpServers":{"docs":{"transport":"sse","url":"https://example.com/sse"}}}`), "")
	if err != nil || len(candidates[0].Problems) == 0 {
		t.Fatal("legacy SSE silently converted")
	}
	s := testService(t)
	_, err = s.render(&Source{Targets: []string{"pi"}, Servers: map[string]Server{
		"a": {Command: "echo", PiExtension: "pi-mcp-adapter"},
		"b": {Command: "echo", PiExtension: "pi-mcp-extension"},
	}})
	if err == nil {
		t.Fatal("mixed extensions must not share a file")
	}
}

func TestPiCredentials(t *testing.T) {
	server := Server{Command: "echo", PiExtension: "pi-mcp-extension", Env: map[string]Value{"TOKEN": {FromEnv: "TOKEN"}, "MODE": {Literal: "dev"}}}
	out, err := Render("pi", server)
	if err != nil {
		t.Fatal(err)
	}
	if out["env"].(map[string]string)["TOKEN"] != "" {
		t.Fatal("must inherit TOKEN instead of writing an unexpanded placeholder")
	}
	server.Env["TOKEN"] = Value{FromEnv: "OTHER"}
	if _, err = Render("pi", server); err == nil {
		t.Fatal("cannot rename inherited variables")
	}
	out, err = Render("pi", Server{URL: "https://example.com/mcp", PiExtension: "pi-mcp-adapter", BearerToken: &Value{FromEnv: "TOKEN"}})
	if err != nil || out["headers"].(map[string]string)["Authorization"] != "Bearer ${TOKEN}" {
		t.Fatalf("%+v %v", out, err)
	}
}

func TestPiDirectoryOverride(t *testing.T) {
	s := testService(t)
	s.ConfigDirs = map[string]string{"pi": filepath.Join(s.Home, "custom-pi")}
	path, err := s.nativePath("pi")
	if err != nil || path != filepath.Join(s.Home, "custom-pi", "mcp-adapter.json") {
		t.Fatalf("%s %v", path, err)
	}
	_, err = s.render(&Source{Targets: []string{"pi"}, Servers: map[string]Server{"docs": {Command: "echo", PiExtension: "pi-mcp-extension"}}})
	if err == nil || !strings.Contains(err.Error(), "unset the override") {
		t.Fatalf("extension ignores the directory override: %v", err)
	}
	candidates, err := Import("", []byte(`{"transport":"sse","url":"https://example.com/sse"}`), "docs")
	if err != nil || len(candidates[0].Problems) == 0 {
		t.Fatal("pasted SSE must not become streamable HTTP")
	}
}

// pi-mcp-adapter 3 reads mcp-adapter.json and left mcp.json to Pi's built-in MCP support;
// pi-mcp-extension still reads mcp.json. Refs: #298.
func TestPiFileFollowsTheExtension(t *testing.T) {
	for _, project := range []bool{false, true} {
		s := testService(t)
		dir := filepath.Join(s.Home, ".pi", "agent")
		if project {
			s.ProjectRoot = filepath.Join(s.Home, "project")
			dir = filepath.Join(s.ProjectRoot, ".pi")
		}
		for extension, file := range map[string]string{"pi-mcp-adapter": "mcp-adapter.json", "pi-mcp-extension": "mcp.json"} {
			if path, _, err := s.destination("pi", Server{PiExtension: extension}); err != nil || path != filepath.Join(dir, file) {
				t.Errorf("project=%v %s: %s %v", project, extension, path, err)
			}
		}
	}
}

// legacyPiService is a Pi home that an earlier Skillshare synced docs into for pi-mcp-adapter:
// the entry sits in mcp.json and the ledger owns it there.
func legacyPiService(t *testing.T) (s *Service, legacy, adapter string, entry map[string]any) {
	t.Helper()
	s = testService(t)
	if err := os.WriteFile(s.ConfigPath, []byte("mcp:\n  targets: [pi]\n  servers:\n    docs:\n      command: docs\n      piExtension: pi-mcp-adapter\n"), 0600); err != nil {
		t.Fatal(err)
	}
	entry, err := Render("pi", Server{Command: "docs", PiExtension: "pi-mcp-adapter"})
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(s.Home, ".pi", "agent")
	legacy, adapter = filepath.Join(dir, "mcp.json"), filepath.Join(dir, "mcp-adapter.json")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	owned := ownership{Owner: s.ConfigPath, Target: "pi", Path: legacy, Name: "docs", Hash: entryHash(managedEntry("pi", entry))}
	if err := writeJSONFile(s.statePath(), ledger{Version: 1, Entries: map[string]ownership{ownershipKey("pi", legacy, "docs"): owned}}); err != nil {
		t.Fatal(err)
	}
	return s, legacy, adapter, entry
}

func TestPiAdapterMovesOutOfMcpJSON(t *testing.T) {
	s, legacy, adapter, entry := legacyPiService(t)
	if err := writeJSONFile(legacy, map[string]any{"mcpServers": map[string]any{"docs": entry, "mine": map[string]any{"command": "mine"}}}); err != nil {
		t.Fatal(err)
	}
	plan, err := s.Preview()
	if err != nil || plan.Blocked {
		t.Fatalf("%+v %v", plan, err)
	}
	if c := changeFor(plan, legacy, "docs"); c == nil || c.Action != "remove" {
		t.Fatalf("old entry: %+v", c)
	}
	if c := changeFor(plan, adapter, "docs"); c == nil || c.Action != "add" {
		t.Fatalf("new entry: %+v", c)
	}
	if _, err := s.Apply(plan.Revision); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(legacy); strings.Contains(string(data), `"docs"`) || !strings.Contains(string(data), `"mine"`) {
		t.Fatalf("mcp.json: %s", data)
	}
}

// Pi's warning tells the user to mv mcp.json to mcp-adapter.json. Skillshare keeps owning
// what it wrote there instead of reporting the moved entry as the user's own.
func TestPiAdapterKeepsOwningAMovedFile(t *testing.T) {
	s, _, adapter, entry := legacyPiService(t)
	if err := writeJSONFile(adapter, map[string]any{"mcpServers": map[string]any{"docs": entry}}); err != nil {
		t.Fatal(err)
	}
	plan, err := s.Preview()
	if err != nil || plan.Blocked {
		t.Fatalf("%+v %v", plan, err)
	}
	if _, err := s.Apply(plan.Revision); err != nil {
		t.Fatal(err)
	}
	state, _, _ := s.loadLedger()
	if _, owned := state.Entries[ownershipKey("pi", adapter, "docs")]; !owned {
		t.Fatalf("ownership not moved: %+v", state.Entries)
	}
}

// Both files are Pi's, so import and the unmanaged scan read the one each extension uses.
func TestPiImportReadsBothFiles(t *testing.T) {
	s := testService(t)
	dir := filepath.Join(s.Home, ".pi", "agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	for file, name := range map[string]string{"mcp-adapter.json": "adapted", "mcp.json": "extended"} {
		if err := writeJSONFile(filepath.Join(dir, file), map[string]any{"mcpServers": map[string]any{name: map[string]any{"command": name}}}); err != nil {
			t.Fatal(err)
		}
	}
	candidates, err := s.ImportClient("pi")
	if err != nil || len(candidates) != 2 {
		t.Fatalf("%+v %v", candidates, err)
	}
	for _, c := range candidates {
		if c.Name == "adapted" && c.Server.PiExtension != "pi-mcp-adapter" {
			t.Errorf("mcp-adapter.json is only read by pi-mcp-adapter: %+v", c)
		}
	}
	var names []string
	for _, found := range s.FindUnmanaged(&Source{ConfigPath: s.ConfigPath}) {
		names = append(names, found.Names...)
	}
	if strings.Join(names, ",") != "adapted,extended" {
		t.Fatalf("unmanaged: %v", names)
	}
}
