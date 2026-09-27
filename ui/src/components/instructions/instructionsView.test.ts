import { describe, expect, it } from 'vitest';
import type { SharedInstructionsFile, SharedInstructionsTarget } from '../../api/client';
import { connectPlan, importLines, lineCount, lineDiff, lineRanges, needsSync, overLimit, restorePlan, rowHint, setupPathProblem, sharedNameProblem, worstStatus } from './instructionsView';

describe('importLines', () => {
  it('finds @path lines outside code fences', () => {
    expect(importLines('# Notes\n@RTK.md\n```\n@not-this\n```\n@AGENTS.md\n')).toEqual([2, 6]);
  });

  it('ignores @ mentions inside prose', () => {
    expect(importLines('Ask @someone before merging.')).toEqual([]);
  });
});

describe('lineRanges', () => {
  it('folds consecutive lines into ranges', () => {
    expect(lineRanges([3, 7, 8, 9])).toBe('3, 7–9');
  });
});

describe('lineDiff', () => {
  it('marks removed and added lines around unchanged ones', () => {
    expect(lineDiff('a\nb\nc\n', 'a\nc\nd\n')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'same', text: 'c' },
      { kind: 'add', text: 'd' },
    ]);
  });
});

describe('worstStatus', () => {
  it('picks the status that most needs attention', () => {
    expect(worstStatus([
      { name: 'a', mode: 'import', status: 'synced' },
      { name: 'b', mode: 'import', status: 'modified' },
    ])).toBe('modified');
  });
});

describe('overLimit', () => {
  const file = (name: string, chars: number): SharedInstructionsFile => ({ name, file: 'AGENTS.md', path: `/x/${name}/AGENTS.md`, exists: true, size: chars, chars, targets: 0 });
  const windsurf: SharedInstructionsTarget = {
    name: 'windsurf', path: '/h/.codeium/windsurf/memories/global_rules.md', import: false, exists: true, max_chars: 6000,
    assigned: [{ name: 'work', mode: 'symlink', status: 'synced' }],
  };

  it('lists only assigned files longer than the target reads', () => {
    expect(overLimit(windsurf, [file('work', 7000), file('personal', 9000)]).map((f) => f.name)).toEqual(['work']);
  });
});

describe('sharedNameProblem', () => {
  it('rejects names the server would refuse', () => {
    expect(sharedNameProblem('my file', [])).toBe('invalid');
  });

  it('flags a name another extra already uses', () => {
    expect(sharedNameProblem('team', ['rules', 'team'])).toBe('taken');
  });

  it('treats a name that differs only in case as taken', () => {
    expect(sharedNameProblem('Team', ['team'])).toBe('taken');
  });

  it('accepts a new valid name', () => {
    expect(sharedNameProblem('work-2', ['team'])).toBeNull();
  });
});

describe('setupPathProblem', () => {
  it('accepts a ~/ or absolute file in global mode', () => {
    expect([setupPathProblem('~/.myagent/AGENTS.md', false), setupPathProblem('/opt/a/AGENTS.md', false)]).toEqual([null, null]);
  });

  it('refuses a relative file in global mode', () => {
    expect(setupPathProblem('AGENTS.md', false)).toBe('relative');
  });

  it('refuses an absolute file in project mode', () => {
    expect(setupPathProblem('~/AGENTS.md', true)).toBe('absolute');
  });

  it('refuses a directory', () => {
    expect(setupPathProblem('.myagent/', true)).toBe('directory');
  });
});

describe('connect and restore plans', () => {
  const general: SharedInstructionsFile = { name: 'general', file: 'AGENTS.md', path: '/x/general/AGENTS.md', exists: true, size: 7000, chars: 7000, targets: 0 };
  const tg = (name: string, rest: Partial<SharedInstructionsTarget> = {}): SharedInstructionsTarget => ({ name, path: `/h/${name}/AGENTS.md`, import: false, exists: true, assigned: [], ...rest });
  const claude = tg('claude', { import: true, assigned: [{ name: 'team', mode: 'import', status: 'synced' }] });
  const opencode = tg('opencode', { assigned: [{ name: 'team', mode: 'symlink', status: 'synced' }] });
  const windsurf = tg('windsurf', { max_chars: 6000 });
  const antigravity = tg('antigravity', { same_as: 'gemini' });

  it('adds an import line and keeps the other files of an import target', () => {
    expect(connectPlan([claude], general)).toEqual([{ target: 'claude', extras: ['team', 'general'], note: 'import' }]);
  });

  it('replaces a link target on another file and says which', () => {
    expect(connectPlan([opencode], general)).toEqual([{ target: 'opencode', extras: ['general'], note: 'switch', other: 'team' }]);
  });

  it('warns when a target reads less than the file holds', () => {
    expect(connectPlan([windsurf], general)[0]).toMatchObject({ note: 'tooLong', max: 6000 });
  });

  it('never includes targets that read another target\'s file', () => {
    expect(connectPlan([antigravity], general)).toEqual([]);
  });

  it('keeps the other import lines when restoring an import target', () => {
    const both = tg('claude', { import: true, assigned: [{ name: 'team', mode: 'import', status: 'synced' }, { name: 'general', mode: 'import', status: 'synced' }] });
    expect(restorePlan([both], 'general')).toEqual([{ target: 'claude', note: 'importKeep', others: ['team'] }]);
  });

  it('warns that outside edits are backed up before restoring', () => {
    const edited = tg('gemini', { assigned: [{ name: 'general', mode: 'symlink', status: 'modified' }] });
    expect(restorePlan([edited], 'general')).toEqual([{ target: 'gemini', note: 'modified' }]);
  });

  it('counts only connected targets whose file or link is missing or off as needing sync', () => {
    const lost = tg('codex', { assigned: [{ name: 'general', mode: 'symlink', status: 'not synced' }] });
    const fine = tg('amp', { assigned: [{ name: 'general', mode: 'symlink', status: 'synced' }] });
    expect(needsSync([lost, fine, opencode], 'general').map((t) => t.name)).toEqual(['codex']);
  });

  it('tells a link target on another file which one it uses now', () => {
    expect(rowHint(opencode, general)).toEqual({ kind: 'usesOther', name: 'team' });
  });

  it('tells an import target which other files it also uses', () => {
    expect(rowHint(claude, general)).toEqual({ kind: 'alsoUses', names: ['team'] });
  });
});

describe('lineCount', () => {
  it('does not count the trailing newline as a line', () => {
    expect(lineCount('# A\n\nb\n')).toBe(3);
  });
});
