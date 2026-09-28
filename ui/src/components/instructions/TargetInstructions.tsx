import { Fragment, useId, useMemo, useState } from 'react';
import { Link, useBeforeUnload, useBlocker, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileX, Info, TriangleAlert, X } from 'lucide-react';
import { api } from '../../api/client';
import type { InstructionsEntry, TargetInstructions as Data } from '../../api/client';
import Button from '../Button';
import CodeEditor from '../CodeEditor';
import ConfirmDialog from '../ConfirmDialog';
import DialogShell from '../DialogShell';
import EmptyState from '../EmptyState';
import { Checkbox, Input } from '../Input';
import { targetLabel } from '../mcp/mcpView';
import { PageSkeleton } from '../Skeleton';
import { useToast } from '../Toast';
import { useAppContext } from '../../context/AppContext';
import { useT } from '../../i18n';
import { queryKeys } from '../../lib/queryKeys';
import { fileName, shortenHome } from '../../lib/paths';
import ConvertDialog from './ConvertDialog';
import InstructionFileList from './InstructionFileList';
import { useFillHeight } from './useFillHeight';
import { BoxHeader, InstructionsPreview } from './ViewTabs';
import { useSaveShortcut } from './useSaveShortcut';
import { instructionsErrorMessage, importDecor, readChain, refreshInstructions, setupPathOf, setupPathProblem, sharedOfImport } from './instructionsView';


// The page's bottom padding, and the least height the tab keeps on a short window.
const PAGE_BOTTOM = 40;
const MIN_TAB = 480;

/**
 * ① A target's Instructions tab, filling the window down to the page bottom so
 * the editor gets the room. Tools that read this target's skills but keep
 * their own instruction file (riders: Codex under universal) are listed beside
 * it; the pick lives in ?tool= so it survives a reload.
 */
export default function TargetInstructions({ name }: { name: string }) {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const { data } = useQuery({ queryKey: queryKeys.instructions.target(name), queryFn: () => api.getTargetInstructions(name) });
  const [fillRef, height] = useFillHeight<HTMLDivElement>(PAGE_BOTTOM, MIN_TAB);
  const riders = data?.riders ?? [];
  if (!data?.supported || riders.length === 0) {
    return <div ref={fillRef} style={{ height }} className="flex flex-col"><Panel name={name} /></div>;
  }

  const tool = riders.find((r) => r.name === params.get('tool'))?.name ?? name;
  // Switching tools is a navigation, so the editor's guard asks before an unsaved edit is dropped.
  const pick = (next: string) => setParams((prev) => {
    const p = new URLSearchParams(prev);
    if (next === name) p.delete('tool');
    else p.set('tool', next);
    return p;
  }, { replace: true });
  // Tools by the name people know them by (Codex, not codex); the target itself keeps its own name.
  const items = [
    { id: name, label: name, path: data.path ?? '', exists: data.exists },
    ...riders.map((r) => ({ id: r.name, label: targetLabel(r.name), path: r.path, exists: r.exists })),
  ];

  return (
    <div ref={fillRef} style={{ height }} className="grid grid-cols-[220px_minmax(0,1fr)] gap-7">
      <InstructionFileList items={items} selected={tool} onSelect={pick} divider={1} caption={t('instructions.files.caption', { name })} />
      <div className="flex min-h-0 min-w-0 flex-col">
        <Panel key={tool} name={tool} />
      </div>
    </div>
  );
}

/** The files a target (or rider) reads, in order, and an editor for its own file. */
function Panel({ name }: { name: string }) {
  const t = useT();
  const { data, error, isPending } = useQuery({ queryKey: queryKeys.instructions.target(name), queryFn: () => api.getTargetInstructions(name) });
  if (isPending) return <PageSkeleton />;
  if (error) return <div className="ss-note bad"><span className="flex-1">{instructionsErrorMessage(error, t)}</span></div>;
  // skillshare does not know the file: let the user say which one the tool reads.
  if (!data.supported && name !== 'cursor') return <SetupFormInline data={data} />;
  if (!data.supported) {
    return (
      <EmptyState
        icon={FileX}
        title={t('instructions.target.none.title', { name })}
        description={t(name === 'cursor' && !data.project ? 'instructions.target.none.cursor' : 'instructions.target.none.description', { name })}
      />
    );
  }
  // Remount on a new file version so the draft starts from it.
  return <Editor key={`${data.path}:${data.content}`} data={data} />;
}

/**
 * Which file the target reads: for a tool skillshare does not know, or to move
 * a known tool's file elsewhere (builtIn: it has a default to go back to).
 * onDone runs after a save or reset.
 */
function useSetupForm(data: Data, onDone?: () => void) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectRoot } = useAppContext();
  const id = useId();
  const builtIn = Boolean(data.default_path);
  const [path, setPath] = useState(data.setup?.path ?? (data.supported && data.path ? setupPathOf(data.path, data.project, projectRoot) : ''));
  const [imports, setImports] = useState(data.setup?.import ?? (data.supported && data.import));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  // What the server said about the last save or reset, shown in the form as it came.
  const [failure, setFailure] = useState('');
  const problem = setupPathProblem(path, data.project);
  const example = data.project ? `.${data.target}/AGENTS.md` : `~/.${data.target}/AGENTS.md`;


  const save = async () => {
    setSaving(true);
    setFailure('');
    try {
      await api.setTargetInstructionsSetup(data.target, { path: path.trim(), import: imports });
      refreshInstructions(queryClient);
      toast(t('instructions.setup.saved'), 'success');
      onDone?.();
    } catch (err) {
      setFailure(instructionsErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  // Back to the built-in file, or, for a tool skillshare does not know, no file.
  const reset = async () => {
    setResetting(true);
    setFailure('');
    try {
      await api.removeTargetInstructionsSetup(data.target);
      refreshInstructions(queryClient);
      toast(t('instructions.setup.removed'), 'success');
      onDone?.();
    } catch (err) {
      setFailure(instructionsErrorMessage(err, t));
    } finally {
      setResetting(false);
    }
  };

  const title = t(builtIn ? 'instructions.setup.builtInTitle' : 'instructions.setup.title', { name: data.target });
  const description = builtIn ? t('instructions.setup.builtInDescription', { path: shortenHome(data.default_path ?? '') }) : t('instructions.setup.description', { name: data.target });
  const fields = (
    <>
      <div className="ss-fld">
        <label htmlFor={id}>{t(builtIn ? 'instructions.setup.locationLabel' : 'instructions.setup.pathLabel')}</label>
        <Input id={id} value={path} onChange={(e) => setPath(e.target.value)} placeholder={example} className="font-mono" spellCheck={false} autoComplete="off" />
        <span className={`hp ${problem ? '!text-bad' : ''}`}>
          {problem ? t(`instructions.setup.problem.${problem}`)
            : builtIn && !data.project ? t('instructions.setup.pathHelpBuiltIn')
              : t(data.project ? 'instructions.setup.pathHelpProject' : 'instructions.setup.pathHelp', { example })}
        </span>
      </div>
      <Checkbox label={t('instructions.setup.import')} checked={imports} onChange={setImports} size="sm" />
      {failure && <div className="ss-note bad"><span className="flex-1">{failure}</span></div>}
    </>
  );
  const busy = saving || resetting;
  const saveButton = <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!path.trim() || problem !== null || resetting}>{t('common.save')}</Button>;
  const resetButton = data.custom && (
    <Button variant="ghost" size="sm" onClick={reset} loading={resetting} disabled={saving}>{t(builtIn ? 'instructions.setup.reset' : 'instructions.setup.remove')}</Button>
  );
  return { title, description, fields, busy, saveButton, resetButton };
}

/** The location form in the page, for a target with no known file: there is nothing else to show. */
function SetupFormInline({ data }: { data: Data }) {
  const f = useSetupForm(data);
  return (
    <div className="ss-box flex max-w-[560px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">{f.title}</h3>
        <p className="text-[13px] text-ink-2">{f.description}</p>
      </div>
      {f.fields}
      <div className="flex items-center gap-2">{f.saveButton}</div>
    </div>
  );
}

/** Change which file a target reads. */
function PathDialog({ data, onClose }: { data: Data; onClose: () => void }) {
  const t = useT();
  const f = useSetupForm(data, onClose);
  return (
    <DialogShell open onClose={onClose} padding="none" preventClose={f.busy} ariaLabel={f.title} className="!max-w-[540px]">
      <div className="dh">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="ss-h2">{f.title}</h2>
          <p className="text-[13px] text-ink-2">{f.description}</p>
        </div>
        <button type="button" className="ss-ib" aria-label={t('common.close')} onClick={onClose} disabled={f.busy}><X size={16} /></button>
      </div>
      <div className="db flex flex-col gap-4">{f.fields}</div>
      <div className="df">
        {f.resetButton}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose} disabled={f.busy}>{t('common.cancel')}</Button>
        {f.saveButton}
      </div>
    </DialogShell>
  );
}

function Editor({ data }: { data: Data }) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(data.content);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [changingPath, setChangingPath] = useState(false);
  // Preview renders the draft, so switching keeps unsaved edits.
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const path = data.path ?? '';
  const file = fileName(path);
  const linked = Boolean(data.link_shared);
  const shared = data.shared;
  const tooLong = Boolean(data.max_chars) && [...draft].length > (data.max_chars ?? 0);
  const importNote = !data.project && data.convert.includes('import') && shared.length === 0;
  // The server refuses to move a file a shared AGENTS.md is written into.
  const inUse = linked || shared.length > 0;

  // Says at the end of each @import line who expands it; the import-target
  // wording is about converting, so it drops that part once nothing is left to convert.
  const lineDecor = useMemo(() => {
    const names = shared.map((s) => s.name);
    const why = !data.import ? t('instructions.target.lineNote.other')
      : data.convert.length > 0 ? t('instructions.target.lineNote.import', { name: data.target, file })
        : t('instructions.target.lineNote.importOnly', { name: data.target });
    return (lines: string[]) => importDecor(lines, (line, inBlock) => {
      const name = inBlock ? sharedOfImport(line, names) : undefined;
      return name ? `${name} · ${why}` : why;
    });
  }, [shared, data.import, data.convert.length, data.target, file, t]);

  // Leaving with an unsaved edit asks first: links, the sidebar, other tools in the list, a reload.
  const dirty = draft !== data.content;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty
    && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useBeforeUnload((e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  const save = async () => {
    setSaving(true);
    try {
      await api.putTargetInstructions(data.target, draft);
      refreshInstructions(queryClient);
      toast(t('instructions.saved', { path: shortenHome(path) }), 'success');
    } catch (err) {
      toast(instructionsErrorMessage(err, t), 'error');
    } finally {
      setSaving(false);
    }
  };
  // Only an editable file with changes; the same in Edit and Preview.
  useSaveShortcut(() => {
    if (!saving && draft !== data.content) void save();
  }, !linked);

  const order = readChain(data.read_order);
  const readBy = data.read_by.map(targetLabel).join(t('instructions.shared.listSep'));
  const unread = data.read_order.some((e) => e.kind === 'unread');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {importNote && (
        <div className="ss-note inf">
          <Info size={16} />
          <span className="flex-1">{t('instructions.target.importNote', { name: data.target, file })}</span>
          <Button variant="secondary" size="sm" onClick={() => setConverting(true)}>{t('instructions.convert.open')}</Button>
        </div>
      )}

      <div className="flex min-h-8 items-center gap-3.5">
        <span className="min-w-0 truncate font-mono text-[14px] font-semibold" title={path}>{shortenHome(path)}</span>
        {/* Lines and size are in the box header below; this says only what they cannot. */}
        {(!data.exists || linked) && (
          <span className="shrink-0 text-[12px] text-ink-3">
            {[!data.exists && t('instructions.target.notCreated'), linked && t('instructions.target.linked')].filter(Boolean).join(' · ')}
          </span>
        )}
        <span className="flex-1" />
        {/* A rider is not a target, so there is no setting to change for it; one on a shared file moves only after it is off. */}
        {/* A disabled button gets no hover, so the reason sits on a wrapper. */}
        {!data.rider_of && (
          <span title={inUse ? t('instructions.setup.locationLocked') : undefined}>
            <Button variant="ghost" size="sm" onClick={() => setChangingPath(true)} disabled={inUse}>{t('instructions.setup.changeLocation')}</Button>
          </span>
        )}
        {data.convert.length > 0 && !linked && !importNote && (
          <Button variant="ghost" size="sm" onClick={() => setConverting(true)} disabled={draft !== data.content}>{t('instructions.convert.open')}</Button>
        )}
        {!linked && <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={draft === data.content}>{t('common.save')}</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-2">
        <span className="text-ink-3">{t('instructions.target.readOrder')}</span>
        {order.map((e, i) => (
          <Fragment key={e.path}>
            {i > 0 && <span className="text-ink-3" aria-hidden="true">→</span>}
            <ReadOrderItem entry={e} target={data.target} />
          </Fragment>
        ))}
        {unread && (
          <>
            <span className="text-ink-3" aria-hidden="true">·</span>
            <span className="text-ink-3">{t('instructions.target.unreadShort')}</span>
          </>
        )}
        {readBy && (
          <>
            <span className="text-ink-3" aria-hidden="true">·</span>
            <span className="text-ink-3">{t('instructions.target.readBy', { names: readBy })}</span>
          </>
        )}
        <span className="flex-1" />
        {!data.project && (
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <span className="text-ink-3">{t('instructions.target.sharedTitle')}</span>
            {shared.map((s) => (
              <Link key={s.name} to={`/extras?tab=instructions&file=${encodeURIComponent(s.name)}`} className="font-mono font-semibold text-ink hover:underline">{s.name}</Link>
            ))}
            <Link to="/extras?tab=instructions" className="font-semibold text-ink hover:underline">
              {t(shared.length > 0 ? 'instructions.target.sharedChange' : 'instructions.target.sharedPick')}
            </Link>
          </span>
        )}
      </div>

      {linked && (
        <p className="text-[13px] text-ink-2">
          {t('instructions.target.linkedHint')}{' '}
          <Link to={`/extras?tab=instructions&file=${encodeURIComponent(data.link_shared ?? '')}`} className="font-mono font-semibold text-ink hover:underline">{data.link_shared}</Link>
        </p>
      )}

      <div className="ss-code flex min-h-[360px] flex-1 flex-col !bg-surface !overflow-hidden !p-0 !whitespace-normal focus-within:!border-[var(--accent)]">
        <BoxHeader content={draft} view={view} onChange={setView} />
        {view === 'edit' ? (
          <CodeEditor value={draft} onChange={setDraft} ariaLabel={file} lineDecor={lineDecor} disabled={saving || linked} wrap fill
            className="min-h-0 flex-1 !rounded-none !border-0 !bg-surface" placeholder={t('instructions.target.placeholder', { file })} />
        ) : (
          <InstructionsPreview content={draft} names={shared.map((s) => s.name)} />
        )}
      </div>
      {tooLong && (
        <p className="flex items-center gap-2 text-[13px] text-warn">
          <TriangleAlert size={15} className="shrink-0" />
          {t('instructions.tooLong', { name: data.target, max: data.max_chars?.toLocaleString() ?? '' })}
        </p>
      )}

      {converting && <ConvertDialog data={{ ...data, content: draft }} onClose={() => setConverting(false)} />}
      {changingPath && <PathDialog data={data} onClose={() => setChangingPath(false)} />}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('config.discard.title')}
        message={t('config.discard.message')}
        confirmText={t('config.discard.confirmText')}
        variant="danger"
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
        onCancel={() => blocker.state === 'blocked' && blocker.reset()}
      />
    </div>
  );
}

/** One file in the read-order line: a dot for whether the target loads it now. */
function ReadOrderItem({ entry, target }: { entry: InstructionsEntry; target: string }) {
  const t = useT();
  const name = entry.kind === 'rules' ? `${fileName(entry.path)}/*.md` : fileName(entry.path);
  const detail = entry.kind === 'rules' ? t(entry.count === 1 ? 'instructions.target.rules.one' : 'instructions.target.rules.other', { count: entry.count ?? 0 })
    : entry.kind === 'fallback' && !entry.read && entry.exists ? t('instructions.target.fallbackSkipped', { name: target })
      : '';
  const state = entry.read ? 'loaded' : entry.exists ? 'skipped' : 'missing';
  return (
    <span className="inline-flex items-center gap-1.5" title={`${shortenHome(entry.path)} · ${state}`}>
      <span className={`ss-st ${entry.read ? 'ok' : 'off'} !gap-1.5 font-mono !text-[12px] !font-normal ${entry.read ? 'text-ink' : ''}`}>{name}</span>
      {detail && <span className="text-ink-3">{detail}</span>}
    </span>
  );
}

