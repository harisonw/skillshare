package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"skillshare/internal/config"
	"skillshare/internal/oplog"
	"skillshare/internal/sync"
	"skillshare/internal/ui"
)

// cmdBackupFiles handles `skillshare backup files`: the versions skillshare
// saved of single files (instruction files, shared-file targets) before
// rewriting them.
func cmdBackupFiles(mode runMode, args []string) error {
	cwd, _ := os.Getwd()
	if mode == modeAuto && projectConfigExists(cwd) {
		mode = modeProject
	}
	applyModeLabel(mode)
	root := ""
	if mode == modeProject {
		root = cwd
	}

	sub := "list"
	if len(args) > 0 {
		sub, args = args[0], args[1:]
	}
	if hasFlag(args, "--help") || hasFlag(args, "-h") || sub == "--help" || sub == "-h" {
		printBackupFilesHelp()
		return nil
	}

	switch sub {
	case "list", "ls":
		return backupFilesList(root)
	case "show":
		if len(args) != 1 {
			return fmt.Errorf("usage: skillshare backup files show <path>")
		}
		return backupFilesShow(root, args[0])
	case "restore":
		var positional []string
		unlink, dryRun := false, false
		for _, a := range args {
			switch a {
			case "--unlink":
				unlink = true
			case "--dry-run", "-n":
				dryRun = true
			default:
				positional = append(positional, a)
			}
		}
		if len(positional) != 2 {
			return fmt.Errorf("usage: skillshare backup files restore <path> <id> [--unlink] [--dry-run]")
		}
		return backupFilesRestore(root, positional[0], positional[1], unlink, dryRun)
	default:
		return fmt.Errorf("unknown backup files command %q (use list, show, or restore)", sub)
	}
}

// resolveBackupFilePath makes path absolute and, in project mode (root set),
// requires it to be inside the project.
func resolveBackupFilePath(root, path string) (string, error) {
	abs, err := filepath.Abs(config.ExpandPath(path))
	if err != nil {
		return "", err
	}
	if root != "" && !sync.PathInside(root, abs) {
		return "", fmt.Errorf("%s is outside the project (use -g for global file history)", abs)
	}
	return abs, nil
}

func backupFilesList(root string) error {
	files, err := sync.ListFileBackups()
	if err != nil {
		return err
	}
	shown := 0
	for _, f := range files {
		if root != "" && !sync.PathInside(root, f.Path) {
			continue
		}
		if shown == 0 {
			ui.Header("File history")
		}
		shown++
		fmt.Printf("  %s  %3d versions  %s\n", f.Latest.Format("2006-01-02 15:04:05"), f.Versions, f.Path)
	}
	if shown == 0 {
		ui.Info("No file backups found")
	}
	return nil
}

func backupFilesShow(root, path string) error {
	abs, err := resolveBackupFilePath(root, path)
	if err != nil {
		return err
	}
	versions, err := sync.FileBackupVersions(abs)
	if err != nil {
		return err
	}
	ui.Header(fmt.Sprintf("Versions of %s", abs))
	for _, v := range versions {
		detail := v.Preview
		switch {
		case v.None:
			detail = "(no file existed)"
		case v.LinkTo != "":
			detail = "(link to " + v.LinkTo + ")"
		}
		fmt.Printf("  %-32s  %s  %-18s  %8s  %s\n",
			v.ID, v.Time.Format("2006-01-02 15:04:05"), fileVersionLabel(v), formatBytes(v.Size), ui.DimText(detail))
	}
	return nil
}

// fileVersionLabel is "<kind>" or "<kind>/<reason>".
func fileVersionLabel(v sync.FileBackupVersion) string {
	if v.Reason == "" {
		return v.Kind
	}
	return v.Kind + "/" + v.Reason
}

func backupFilesRestore(root, path, id string, unlink, dryRun bool) error {
	start := time.Now()
	abs, err := resolveBackupFilePath(root, path)
	if err != nil {
		return err
	}
	if dryRun {
		_, v, err := sync.ReadFileBackupVersion(abs, id)
		if err != nil {
			return err
		}
		if st := sync.CurrentFileState(abs); st.LinkTo != "" && !unlink {
			return fmt.Errorf("%s is a link to %s; add --unlink to replace it with a regular file", abs, st.LinkTo)
		}
		ui.Warning("Dry run - would restore %s to version %s (%s, %s)", abs, v.ID, fileVersionLabel(v), v.Time.Format("2006-01-02 15:04:05"))
		return nil
	}

	saved, err := sync.RestoreFileBackup(abs, id, unlink)
	var linkErr *sync.FileBackupLinkError
	if errors.As(err, &linkErr) {
		return fmt.Errorf("%s is a link to %s; add --unlink to replace it with a regular file", linkErr.Path, linkErr.LinkTo)
	}
	e := oplog.NewEntry("restore", statusFromErr(err), time.Since(start))
	e.Args = map[string]any{"action": "restore-file", "path": abs, "id": id}
	if saved != "" {
		e.Args["backup_id"] = saved
	}
	if err != nil {
		e.Message = err.Error()
	}
	oplog.WriteWithLimit(config.ConfigPath(), oplog.OpsFile, e, logMaxEntries()) //nolint:errcheck
	if err != nil {
		return err
	}
	ui.Success("Restored %s to version %s", abs, id)
	if saved != "" {
		ui.Info("The previous content was saved as version %s", saved)
	}
	return nil
}

func printBackupFilesHelp() {
	fmt.Println(`Usage: skillshare backup files [list] [-p|-g]
       skillshare backup files show <path>
       skillshare backup files restore <path> <id> [--unlink] [--dry-run]

Versions skillshare saved of single files (instruction files and targets of
shared files) before it rewrote or replaced them.

Commands:
  list                 List files with saved versions (default)
  show <path>          List the versions of one file, newest first
  restore <path> <id>  Put a version back; the current content is saved first

Options:
  --project, -p        Only files inside the current project
  --global, -g         All files (default outside a project)
  --unlink             Replace a symlink at <path> with a regular file
  --dry-run, -n        Preview the restore without changing anything
  --help, -h           Show this help

Version IDs:
  <time>[.<reason>]    Saved before skillshare rewrote the file
  drift:<time>...      An edit of yours that skillshare replaced
  origin               The file as it was when first attached

Examples:
  skillshare backup files
  skillshare backup files show ~/.claude/CLAUDE.md
  skillshare backup files restore ~/.claude/CLAUDE.md origin`)
}
