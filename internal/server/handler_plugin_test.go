package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"skillshare/internal/config"
)

func TestPluginAPIRequiresPreviewAndLocalOrigin(t *testing.T) {
	s, _ := newTestServerWithExtras(t, nil, "")
	for _, body := range []string{`{"request":{"action":"sync"}}`, `{"request":{"action":"sync"},"unknown":true}`} {
		w := httptest.NewRecorder()
		s.handlePluginApply(w, httptest.NewRequest(http.MethodPost, "/api/plugins/apply", strings.NewReader(body)))
		if w.Code != 400 {
			t.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
	}
	r := httptest.NewRequest(http.MethodPost, "http://attacker.example/api/plugins/apply", strings.NewReader(`{}`))
	r.RemoteAddr = "127.0.0.1:1234"
	w := httptest.NewRecorder()
	s.requireLocalPlugin(s.handlePluginApply)(w, r)
	if w.Code != 403 {
		t.Fatalf("rebind accepted: %d", w.Code)
	}
}

// The Plugins page draws its Agents from targetDefinitions, so a target that is another
// config directory of an Agent has to be one of them.
func TestPluginListIncludesAnAccountOfAnAgent(t *testing.T) {
	s, _ := newTestServerWithExtras(t, nil, "")
	s.cfg.Targets = map[string]config.TargetConfig{"claude-work": {Agent: "claude", ConfigDir: t.TempDir()}}
	w := httptest.NewRecorder()
	s.handlePluginList(w, httptest.NewRequest(http.MethodGet, "/api/plugins?hosts=false", nil))
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	type definition struct {
		Target string `json:"target"`
		Label  string `json:"label"`
	}
	var inventory struct {
		TargetDefinitions []definition `json:"targetDefinitions"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &inventory); err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(inventory.TargetDefinitions, func(d definition) bool { return d.Target == "claude-work" }) {
		t.Fatalf("the account is missing: %+v", inventory.TargetDefinitions)
	}
}

// A source that cannot be reached answers with a key the dashboard translates, not git's output.
func TestPluginDiscoverNamesANetworkFailure(t *testing.T) {
	s, _ := newTestServerWithExtras(t, nil, "")
	w := httptest.NewRecorder()
	s.handlePluginDiscover(w, httptest.NewRequest(http.MethodPost, "/api/plugins/discover", strings.NewReader(`{"name":"demo","source":"https://127.0.0.1:1/demo.git"}`)))
	var body struct {
		Code string `json:"error_code"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || w.Code != 400 || body.Code != "plugins.error.network" {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
}
