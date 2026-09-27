package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strings"
)

// ValidDirectTools accepts what pi-mcp-adapter documents: a switch, "search", or tool names.
func ValidDirectTools(value any) bool {
	valid := true
	switch v := value.(type) {
	case nil, bool:
	case string:
		valid = v == "search"
	case []string:
		valid = len(v) > 0 && !slices.Contains(v, "")
	case []any:
		valid = len(v) > 0
		for _, item := range v {
			if tool, ok := item.(string); !ok || tool == "" {
				valid = false
			}
		}
	default:
		valid = false
	}
	return valid
}

func (s Server) validateDirectTools(name string) error {
	if s.DirectTools == nil {
		return nil
	}
	switch {
	case !ValidDirectTools(s.DirectTools):
		return fmt.Errorf("MCP %s: directTools must be true, false, \"search\" or a list of tool names", name)
	case s.Disabled:
		return fmt.Errorf("MCP %s: directTools cannot be set on a disabled entry; it only switches the server off", name)
	case s.PiExtension != "pi-mcp-adapter":
		return fmt.Errorf("MCP %s: directTools is a pi-mcp-adapter setting; set piExtension: pi-mcp-adapter", name)
	}
	return nil
}

func (s Server) validatePiOptions(name string) error {
	if len(s.PiOptions) == 0 {
		return nil
	}
	if s.Disabled {
		return fmt.Errorf("MCP %s: piOptions cannot be set on a disabled entry; it only switches the server off", name)
	}
	if s.PiExtension != "pi-mcp-adapter" {
		return fmt.Errorf("MCP %s: piOptions are pi-mcp-adapter settings; set piExtension: pi-mcp-adapter", name)
	}
	for _, key := range append(additionalManagedFields("pi"), "directTools") {
		if _, set := s.PiOptions[key]; set {
			return fmt.Errorf("MCP %s: piOptions cannot set %s; Skillshare writes that field from the server's own settings", name, key)
		}
	}
	return nil
}

// withDirectToolsDefault fills in mcp.directTools for a pi-mcp-adapter server that sets none.
func (s Server) withDirectToolsDefault(value any) Server {
	if s.DirectTools == nil && s.PiExtension == "pi-mcp-adapter" && !s.Disabled {
		s.DirectTools = value
	}
	return s
}

// agentFieldsChanged reports a field outside the ownership hash, Pi's directTools or a
// piOptions key, that the config sets and the file does not have yet. These stay out of
// the hash: people added them to Pi's file by hand before Skillshare could set them, and
// hashing them would turn their next sync into a conflict.
func agentFieldsChanged(target string, current, want map[string]any) bool {
	for key, value := range want {
		if slices.Contains(additionalManagedFields(target), key) {
			continue
		}
		a, _ := json.Marshal(value)
		b, _ := json.Marshal(current[key])
		if !bytes.Equal(a, b) {
			return true
		}
	}
	return false
}

// Pi's extensions differ in file, transport and credential syntax.
// Sync config only: installing or starting either extension remains explicit.
func renderPi(s Server) (map[string]any, error) {
	if s.PiExtension == "" {
		return nil, fmt.Errorf("Pi requires piExtension: pi-mcp-adapter or pi-mcp-extension; install that package in Pi first")
	}
	format := clientFormats["pi"]
	if s.PiExtension == "pi-mcp-adapter" {
		format.refPrefix = "${"
	}
	// The extension passes through the parent's environment, but cannot rename
	// variables or interpolate headers. Never resolve credentials in Skillshare.
	if s.PiExtension == "pi-mcp-extension" {
		env := map[string]Value{}
		for key, value := range s.Env {
			if value.FromEnv != "" {
				if value.FromEnv != key {
					return nil, fmt.Errorf("pi-mcp-extension cannot rename environment variables; use matching names or pi-mcp-adapter")
				}
			} else {
				env[key] = value
			}
		}
		s.Env = env
	}
	out, err := renderAdditionalClient("pi", format, s)
	if err != nil {
		return nil, err
	}
	if s.PiExtension == "pi-mcp-extension" {
		out["transport"] = "stdio"
		if s.URL != "" {
			out["transport"] = "streamable-http"
		}
	} else {
		maps.Copy(out, s.PiOptions)
		if s.DirectTools != nil {
			out["directTools"] = s.DirectTools
		}
		for _, key := range []string{"env", "headers"} {
			values, _ := out[key].(map[string]string)
			for name, value := range values {
				// Adapter leading ! invokes a command. Portable literals must stay literal.
				if strings.HasPrefix(value, "!") {
					values[name] = "!" + value
				}
				if strings.Contains(value, "$env:") {
					return nil, fmt.Errorf("Pi: use fromEnv instead of $env: interpolation")
				}
			}
		}
	}
	return out, nil
}
