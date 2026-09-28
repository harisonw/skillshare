//go:build !windows

package utils

// platformIsJunction returns false: junctions exist only on Windows.
func platformIsJunction(string) bool { return false }
