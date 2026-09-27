import type { QueryClient } from '@tanstack/react-query';
import type { InstructionsAssignment, SharedInstructionsFile, SharedInstructionsTarget } from '../../api/client';
import { queryKeys } from '../../lib/queryKeys';

/** Why a new shared file name would be refused, checked as the user types. Same rule as the server. */
export function sharedNameProblem(name: string, taken: string[]): 'invalid' | 'taken' | null {
  const n = name.trim();
  if (!n) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(n)) return 'invalid';
  // Names are folder names; macOS and Windows ignore case.
  return takenName(n, taken) ? 'taken' : null;
}

/** The existing name that a new name collides with, ignoring case. */
export function takenName(name: string, taken: string[]): string | undefined {
  const n = name.trim().toLowerCase();
  return taken.find((x) => x.toLowerCase() === n);
}

/** Why a target's instruction file path would be refused, checked as the user types. Same rule as the server. */
export function setupPathProblem(path: string, project: boolean): 'directory' | 'absolute' | 'relative' | null {
  const p = path.trim();
  if (!p) return null;
  if (p.endsWith('/') || p.endsWith('\\')) return 'directory';
  const rooted = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
  if (project) return rooted || p.startsWith('~') ? 'absolute' : null;
  return rooted || p.startsWith('~/') ? null : 'relative';
}

/** Refetch everything a change to instruction files can touch. */
export function refreshInstructions(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.instructions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.extras });
  queryClient.invalidateQueries({ queryKey: queryKeys.extrasDiff() });
  queryClient.invalidateQueries({ queryKey: queryKeys.config });
}

/** An @path line: tool-specific import syntax, as the server's ImportLines sees it. */
export const isImportLine = (text: string) => /^\s*@\S+\s*$/.test(text);

/** 1-based numbers of the @import lines outside code fences. */
export function importLines(content: string): number[] {
  const out: number[] = [];
  let fence = false;
  content.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('```')) fence = !fence;
    else if (!fence && isImportLine(line)) out.push(i + 1);
  });
  return out;
}

/** "3", "3–4" or "3, 7–8": line numbers folded into ranges. */
export function lineRanges(lines: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++;
    parts.push(j > i ? `${lines[i]}–${lines[j]}` : `${lines[i]}`);
    i = j;
  }
  return parts.join(', ');
}

export type DiffLine = { kind: 'add' | 'del' | 'same'; text: string };

/** A line diff (LCS) of two small files, for change previews. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before ? before.replace(/\n$/, '').split('\n') : [];
  const b = after ? after.replace(/\n$/, '').split('\n') : [];
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push({ kind: 'add', text: b[j++] });
    } else {
      out.push({ kind: 'del', text: a[i++] });
    }
  }
  return out;
}

/** Tone of an assignment's status for .ss-st. */
export function statusTone(status: string): string {
  if (status === 'synced') return 'ok';
  if (status === 'no source') return 'bad';
  return 'warn';
}

/** The status that most needs attention among a target's shared files. */
export function worstStatus(assigned: InstructionsAssignment[]): string | null {
  const order = ['no source', 'modified', 'drift', 'not synced', 'synced'];
  let worst: string | null = null;
  for (const a of assigned) {
    if (worst === null || order.indexOf(a.status) < order.indexOf(worst)) worst = a.status;
  }
  return worst;
}

export const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

/** Shared files over the limit of a target that cuts its global file short. */
export function overLimit(target: SharedInstructionsTarget, files: SharedInstructionsFile[]): SharedInstructionsFile[] {
  if (!target.max_chars) return [];
  return files.filter((f) => f.chars > target.max_chars! && target.assigned.some((a) => a.name === f.name));
}

/** Names of the shared files a target uses. */
export const usesOf = (target: SharedInstructionsTarget) => target.assigned.map((a) => a.name);

/** Targets connected to a shared file, leaving out ones that only read another target's file. */
export const connectedTo = (targets: SharedInstructionsTarget[], name: string) =>
  targets.filter((tg) => !tg.same_as && usesOf(tg).includes(name));

/** What a target should use after connecting it: import targets add one more file, link targets hold one. */
export const connectExtras = (target: SharedInstructionsTarget, name: string) =>
  (target.import ? [...usesOf(target).filter((n) => n !== name), name] : [name]);

/** Connected targets a sync would fix: the file or its link is gone, or points elsewhere. */
export const needsSync = (targets: SharedInstructionsTarget[], name: string) =>
  connectedTo(targets, name).filter((tg) => ['not synced', 'drift'].includes(tg.assigned.find((a) => a.name === name)!.status));

export type ConnectStep = { target: string; extras: string[]; note: 'import' | 'link' | 'switch' | 'tooLong'; other?: string; max?: number };

/** One step per target that would be connected to file, with what changes for it. */
export function connectPlan(targets: SharedInstructionsTarget[], file: SharedInstructionsFile): ConnectStep[] {
  return targets.filter((tg) => !tg.same_as && !usesOf(tg).includes(file.name)).map((tg) => {
    const step = { target: tg.name, extras: connectExtras(tg, file.name) };
    if (!tg.import && tg.assigned.length > 0) return { ...step, note: 'switch', other: tg.assigned[0].name };
    if (tg.max_chars && file.chars > tg.max_chars) return { ...step, note: 'tooLong', max: tg.max_chars };
    return { ...step, note: tg.import ? 'import' : 'link' };
  });
}

export type RestoreStep = { target: string; note: 'import' | 'importKeep' | 'link' | 'modified'; others?: string[] };

/** One step per target that would stop using name, with what happens to its file. */
export function restorePlan(targets: SharedInstructionsTarget[], name: string): RestoreStep[] {
  return connectedTo(targets, name).map((tg) => {
    const a = tg.assigned.find((x) => x.name === name)!;
    const others = usesOf(tg).filter((n) => n !== name);
    if (a.status === 'modified') return { target: tg.name, note: 'modified' };
    if (a.mode === 'import') return others.length ? { target: tg.name, note: 'importKeep', others } : { target: tg.name, note: 'import' };
    return { target: tg.name, note: 'link' };
  });
}

export type RowHint =
  | { kind: 'sameAs'; name: string }
  | { kind: 'notSynced' | 'drift'; mode: string }
  | { kind: 'noSource' }
  | { kind: 'tooLong'; max: number }
  | { kind: 'usesOther'; name: string }
  | { kind: 'alsoUses'; names: string[] };

/** The one line under a target row that says what matters most about it for file. */
export function rowHint(target: SharedInstructionsTarget, file: SharedInstructionsFile): RowHint | null {
  if (target.same_as) return { kind: 'sameAs', name: target.same_as };
  const a = target.assigned.find((x) => x.name === file.name);
  if (a?.status === 'not synced' || a?.status === 'drift') return { kind: a.status === 'drift' ? 'drift' : 'notSynced', mode: a.mode };
  if (a?.status === 'no source') return { kind: 'noSource' };
  if (target.max_chars && file.chars > target.max_chars) return { kind: 'tooLong', max: target.max_chars };
  const others = usesOf(target).filter((n) => n !== file.name);
  if (!others.length) return null;
  return target.import ? { kind: 'alsoUses', names: others } : { kind: 'usesOther', name: others[0] };
}

/** Line count of a file as an editor shows it: a trailing newline does not start a new line. */
export const lineCount = (content: string) => (content ? content.replace(/\n$/, '').split('\n').length : 0);
