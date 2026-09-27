import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileX, Info, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import type { InstructionsEntry, TargetInstructions as Data } from '../../api/client';
import Button from '../Button';
import CodeEditor from '../CodeEditor';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../EmptyState';
import { Checkbox, Input } from '../Input';
import { PageSkeleton } from '../Skeleton';
import { useToast } from '../Toast';
import { useT } from '../../i18n';
import { queryKeys } from '../../lib/queryKeys';
import { shortenHome } from '../../lib/paths';
import ConvertDialog from './ConvertDialog';
import { formatSize, importLines, isImportLine, lineRanges, refreshInstructions, setupPathProblem } from './instructionsView';

const base = (path: string) => path.split('/').pop() ?? path;

/** ① A target's Instructions tab: the files it reads, in order, and an editor for its own file. */
export default function TargetInstructions({ name }: { name: string }) {
  const t = useT();
  const { data, error, isPending } = useQuery({ queryKey: queryKeys.instructions.target(name), queryFn: () => api.getTargetInstructions(name) });
  const [changingSetup, setChangingSetup] = useState(false);
  if (isPending) return <PageSkeleton />;
  if (error) return <div className="ss-note bad"><span className="flex-1">{error.message}</span></div>;
  // skillshare does not know the file: let the user say which one the tool reads.
  if (!data.supported && name !== 'cursor') return <SetupForm data={data} />;
  if (changingSetup) return <SetupForm data={data} onClose={() => setChangingSetup(false)} />;
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
  return <Editor key={`${data.path}:${data.content}`} data={data} onChangeSetup={() => setChangingSetup(true)} />;
}

/** Where the target's instruction file is, for a tool skillshare does not know. onClose: changing an existing setting. */
function SetupForm({ data, onClose }: { data: Data; onClose?: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = useId();
  const [path, setPath] = useState(data.setup?.path ?? '');
  const [imports, setImports] = useState(data.setup?.import ?? false);
  const [saving, setSaving] = useState(false);
  const problem = setupPathProblem(path, data.project);
  const example = data.project ? `.${data.target}/AGENTS.md` : `~/.${data.target}/AGENTS.md`;

  const save = async () => {
    setSaving(true);
    try {
      await api.setTargetInstructionsSetup(data.target, { path: path.trim(), import: imports });
      refreshInstructions(queryClient);
      toast(t('instructions.setup.saved'), 'success');
      onClose?.();
    } catch (err) {
      toast(err instanceof ApiError && err.code === 'instructions_in_use' ? t('instructions.setup.inUseChange', { name: data.target }) : (err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ss-box flex max-w-[560px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">{t('instructions.setup.title', { name: data.target })}</h3>
        <p className="text-[13px] text-ink-2">{t('instructions.setup.description', { name: data.target })}</p>
      </div>
      <div className="ss-fld">
        <label htmlFor={id}>{t('instructions.setup.pathLabel')}</label>
        <Input id={id} value={path} onChange={(e) => setPath(e.target.value)} placeholder={example} className="font-mono" spellCheck={false} autoComplete="off" />
        <span className={`hp ${problem ? '!text-bad' : ''}`}>
          {problem ? t(`instructions.setup.problem.${problem}`) : t(data.project ? 'instructions.setup.pathHelpProject' : 'instructions.setup.pathHelp', { example })}
        </span>
      </div>
      <Checkbox label={t('instructions.setup.import')} checked={imports} onChange={setImports} size="sm" />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!path.trim() || problem !== null}>{t('common.save')}</Button>
        {onClose && <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>}
      </div>
    </div>
  );
}

function Editor({ data, onChangeSetup }: { data: Data; onChangeSetup: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(data.content);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [removingSetup, setRemovingSetup] = useState(false);
  const [removing, setRemoving] = useState(false);
  const path = data.path ?? '';
  const file = base(path);
  const linked = Boolean(data.link_shared);
  const shared = data.shared;
  const imports = importLines(draft);
  const tooLong = Boolean(data.max_chars) && [...draft].length > (data.max_chars ?? 0);
  const importNote = !data.project && data.convert.includes('import') && shared.length === 0;

  const save = async () => {
    setSaving(true);
    try {
      await api.putTargetInstructions(data.target, draft);
      refreshInstructions(queryClient);
      toast(t('instructions.saved', { path: shortenHome(path) }), 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeSetup = async () => {
    setRemoving(true);
    try {
      await api.removeTargetInstructionsSetup(data.target);
      refreshInstructions(queryClient);
      toast(t('instructions.setup.removed'), 'success');
    } catch (err) {
      toast(err instanceof ApiError && err.code === 'instructions_in_use' ? t('instructions.setup.inUse', { name: data.target }) : (err as Error).message, 'error');
    } finally {
      setRemoving(false);
      setRemovingSetup(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {importNote && (
        <div className="ss-note inf">
          <Info size={16} />
          <span className="flex-1">{t('instructions.target.importNote', { name: data.target, file })}</span>
          <Button variant="secondary" size="sm" onClick={() => setConverting(true)}>{t('instructions.convert.open')}</Button>
        </div>
      )}

      <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-6">
        <aside className="flex flex-col gap-5">
          <div className="ss-list">
            <div className="ss-lh">
              <span className="flex-1">{t('instructions.target.readOrder')}</span>
              <span>{data.project ? 'project' : 'global'}</span>
            </div>
            {data.read_order.map((e, i) => <ReadOrderRow key={e.path} entry={e} n={e.kind === 'unread' ? null : i + 1} target={data.target} />)}
          </div>

          {data.custom && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span className="w-full">{t('instructions.setup.custom')}</span>
              <button type="button" className="min-h-6 font-semibold text-ink-2 hover:text-ink" onClick={onChangeSetup}>{t('instructions.setup.change')}</button>
              <button type="button" className="min-h-6 font-semibold text-ink-2 hover:text-ink" onClick={() => setRemovingSetup(true)}>{t('instructions.setup.remove')}</button>
            </div>
          )}

          {!data.project && (
            <div className="flex flex-col gap-1.5 text-[13px]">
              <span className="font-semibold">{t('instructions.target.sharedTitle')}</span>
              {shared.length > 0 ? (
                <span className="text-ink-2">
                  {t('instructions.target.sharedUses')}{' '}
                  {shared.map((s, i) => (
                    <span key={s.name}>
                      {i > 0 && ', '}
                      <Link to={`/extras?tab=instructions&file=${encodeURIComponent(s.name)}`} className="font-mono font-semibold text-ink hover:underline">{s.name}</Link>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-ink-2">{t('instructions.target.sharedNone')}</span>
              )}
              <Link to="/extras?tab=instructions" className="font-semibold text-ink-2 hover:text-ink">{t('instructions.target.sharedPick')}</Link>
            </div>
          )}
        </aside>

        <section className="ss-list min-w-0">
          <div className="ss-r !min-h-12 !gap-3">
            <span className="min-w-0 truncate font-mono text-[13px] font-semibold" title={path}>{shortenHome(path)}</span>
            <span className="shrink-0 text-[12px] text-ink-3">
              {data.exists ? formatSize(data.size) : t('instructions.target.notCreated')}
              {linked && ` · ${t('instructions.target.linked')}`}
            </span>
            <span className="flex-1" />
            {data.convert.length > 0 && !linked && !importNote && (
              <Button variant="secondary" size="sm" onClick={() => setConverting(true)} disabled={draft !== data.content}>{t('instructions.convert.open')}</Button>
            )}
            {!linked && <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={draft === data.content}>{t('common.save')}</Button>}
          </div>
          {linked && (
            <div className="ss-r !min-h-0 !py-2.5 text-[13px] text-ink-2">
              <span className="flex-1">
                {t('instructions.target.linkedHint')}{' '}
                <Link to={`/extras?tab=instructions&file=${encodeURIComponent(data.link_shared ?? '')}`} className="font-mono font-semibold text-ink hover:underline">{data.link_shared}</Link>
              </span>
            </div>
          )}
          <div className="p-3">
            <CodeEditor value={draft} onChange={setDraft} ariaLabel={file} minHeight="360px" maxHeight="560px" markLine={isImportLine} disabled={saving || linked} placeholder={t('instructions.target.placeholder', { file })} />
          </div>
          {/* The import-target wording is about converting; it means nothing once there is nothing left to convert. */}
          {imports.length > 0 && (!data.import || data.convert.length > 0) && (
            <div className="ss-r !min-h-0 !py-2.5 text-[13px] text-warn">
              <TriangleAlert size={15} className="shrink-0" />
              <span className="flex-1">
                {t(data.import ? 'instructions.target.importLines' : 'instructions.target.importLinesOther', { lines: lineRanges(imports), name: data.target, file })}
              </span>
            </div>
          )}
          {tooLong && (
            <div className="ss-r !min-h-0 !py-2.5 text-[13px] text-warn">
              <TriangleAlert size={15} className="shrink-0" />
              <span className="flex-1">{t('instructions.tooLong', { name: data.target, max: data.max_chars?.toLocaleString() ?? '' })}</span>
            </div>
          )}
        </section>
      </div>

      {converting && <ConvertDialog data={{ ...data, content: draft }} onClose={() => setConverting(false)} />}
      <ConfirmDialog
        open={removingSetup}
        title={t('instructions.setup.removeTitle', { name: data.target })}
        message={t('instructions.setup.removeMessage', { name: data.target })}
        confirmText={t('instructions.setup.remove')}
        variant="danger"
        loading={removing}
        onConfirm={removeSetup}
        onCancel={() => setRemovingSetup(false)}
      />
    </div>
  );
}

function ReadOrderRow({ entry, n, target }: { entry: InstructionsEntry; n: number | null; target: string }) {
  const t = useT();
  const name = entry.kind === 'rules' ? `${base(entry.path)}/*.md` : base(entry.path);
  const detail =
    entry.kind === 'unread' ? t('instructions.target.unread', { name: target })
      : entry.kind === 'rules' ? t(entry.count === 1 ? 'instructions.target.rules.one' : 'instructions.target.rules.other', { count: entry.count ?? 0 })
        : entry.kind === 'fallback' && !entry.read && entry.exists ? t('instructions.target.fallbackSkipped', { name: target })
          : shortenHome(entry.path);
  const state = entry.kind === 'unread' ? 'n/a' : entry.read ? 'loaded' : entry.exists ? 'skipped' : 'missing';
  return (
    <div className="ss-r !min-h-[52px] !gap-2.5" title={entry.path}>
      <span className="ss-cnt w-5 shrink-0 text-center">{n ?? '–'}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate font-mono text-[13px] font-semibold ${entry.read ? '' : 'text-ink-2'}`}>{name}</span>
        <span className={`text-[12px] text-ink-3 ${detail === shortenHome(entry.path) ? 'truncate font-mono' : ''}`}>{detail}</span>
      </span>
      <span className={`ss-st ${entry.read ? 'ok' : 'off'}`}>{state}</span>
    </div>
  );
}
