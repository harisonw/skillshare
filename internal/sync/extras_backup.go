package sync

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"skillshare/internal/config"
)

// keepExtraBackups bounds the backups kept per replaced file.
const keepExtraBackups = 10

// extraBackupDir holds the backup history of one file, keyed by a digest of
// its absolute path: <state>/extras/backups/<digest>/<unix-nano>.bak, plus a
// "path" file naming the original. The state at attach time is recorded as a
// "created" marker (no file existed), a "restore" copy of the file that was
// replaced, or a "restore-link" naming the target of a replaced symlink;
// restore uses only that record, never a newer history backup.
func extraBackupDir(path string) string {
	sum := sha256.Sum256([]byte(filepath.Clean(path)))
	return filepath.Join(config.StateDir(), "extras", "backups", fmt.Sprintf("%x", sum[:8]))
}

// backupExtraFile saves the current content of path before skillshare replaces
// it. A copy identical to the latest backup is not stored again.
func backupExtraFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	if latest, ok, _ := latestExtraBackup(path); ok && bytes.Equal(latest, data) {
		return nil
	}
	dir := extraBackupDir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	if err := os.WriteFile(filepath.Join(dir, "path"), []byte(filepath.Clean(path)), 0644); err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	name := fmt.Sprintf("%019d.bak", time.Now().UnixNano())
	if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	pruneExtraBackups(dir)
	return nil
}

// backupExtraDrift saves an edited target that skillshare is about to relink.
// It lives apart from the regular backups so restore never picks it.
func backupExtraDrift(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	dir := filepath.Join(extraBackupDir(path), "drift")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	name := fmt.Sprintf("%019d.bak", time.Now().UnixNano())
	if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	pruneExtraBackups(dir)
	return nil
}

// extraBackupNames returns the backup file names of dir, oldest first.
func extraBackupNames(dir string) []string {
	entries, _ := os.ReadDir(dir)
	var names []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".bak") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names) // zero-padded nanosecond names sort by time
	return names
}

func latestExtraBackup(path string) ([]byte, bool, error) {
	dir := extraBackupDir(path)
	names := extraBackupNames(dir)
	if len(names) == 0 {
		return nil, false, nil
	}
	data, err := os.ReadFile(filepath.Join(dir, names[len(names)-1]))
	if err != nil {
		return nil, false, err
	}
	return data, true, nil
}

// pruneExtraBackups is best effort: a backup that fails to delete only costs
// disk space.
func pruneExtraBackups(dir string) {
	names := extraBackupNames(dir)
	for len(names) > keepExtraBackups {
		_ = os.Remove(filepath.Join(dir, names[0]))
		names = names[1:]
	}
}

// Attach-time records, one per target path. Exactly one is kept at a time.
const (
	attachCreated     = "created"      // no file existed
	attachRestore     = "restore"      // copy of the file that was replaced
	attachRestoreLink = "restore-link" // link target of a symlink that was replaced
)

func markExtraCreated(path string) error {
	return recordExtraAttach(path, attachCreated, nil, 0644)
}

// recordExtraAttach writes the attach-time record name for path, replacing
// any other record.
func recordExtraAttach(path, name string, data []byte, perm os.FileMode) error {
	dir := extraBackupDir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "path"), []byte(filepath.Clean(path)), 0644); err != nil {
		return err
	}
	clearExtraAttach(path)
	return os.WriteFile(filepath.Join(dir, name), data, perm)
}

// recordExtraRestorePoint backs up the file at path when a target is attached
// over it and records that content as what restore puts back. importLine, left
// in the file by an earlier import mode, is not part of the user's file and is
// dropped from the record.
func recordExtraRestorePoint(path, importLine string) error {
	if err := backupExtraFile(path); err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err == nil {
		if stripped, changed := removeImportLine(string(data), importLine); changed {
			data = []byte(stripped)
		}
		err = recordExtraAttach(path, attachRestore, data, 0600)
	}
	if err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	return nil
}

// recordExtraRestoreLink records the symlink at path, which is not ours, as
// what restore puts back.
func recordExtraRestoreLink(path string) error {
	dest, err := os.Readlink(path)
	if err == nil {
		err = recordExtraAttach(path, attachRestoreLink, []byte(dest), 0644)
	}
	if err != nil {
		return fmt.Errorf("back up %s: %w", path, err)
	}
	return nil
}

// extraAttached reports whether an attach-time state is recorded for path.
func extraAttached(path string) bool {
	dir := extraBackupDir(path)
	for _, name := range []string{attachCreated, attachRestore, attachRestoreLink} {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			return true
		}
	}
	return false
}

// putBackExtraRestorePoint recreates at path (which must not exist) the state
// recorded at attach time: the replaced file, the replaced symlink, or nothing
// when no file existed. Without a record it falls back to the latest backup.
// The record is dropped once restored.
func putBackExtraRestorePoint(path string) error {
	dir := extraBackupDir(path)
	switch {
	case extraCreated(path):
	case fileExists(filepath.Join(dir, attachRestoreLink)):
		dest, err := os.ReadFile(filepath.Join(dir, attachRestoreLink))
		if err == nil {
			err = os.Symlink(string(dest), path)
		}
		if err != nil {
			return fmt.Errorf("failed to restore %s: %w", path, err)
		}
	default:
		data, err := os.ReadFile(filepath.Join(dir, attachRestore))
		ok := err == nil
		if os.IsNotExist(err) {
			data, ok, err = latestExtraBackup(path)
		}
		if err != nil {
			return fmt.Errorf("failed to read backup of %s: %w", path, err)
		}
		if ok {
			if err := os.WriteFile(path, data, 0644); err != nil {
				return fmt.Errorf("failed to restore %s: %w", path, err)
			}
		}
	}
	clearExtraAttach(path)
	return nil
}

func fileExists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

// clearExtraAttach drops the attach-time record of path.
func clearExtraAttach(path string) {
	dir := extraBackupDir(path)
	for _, name := range []string{attachCreated, attachRestore, attachRestoreLink} {
		_ = os.Remove(filepath.Join(dir, name))
	}
}

func extraCreated(path string) bool {
	_, err := os.Stat(filepath.Join(extraBackupDir(path), "created"))
	return err == nil
}
