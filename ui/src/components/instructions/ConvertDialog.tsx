import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { ApiError, api } from '../../api/client';
import type { ConvertMethod, InstructionsChange, TargetInstructions } from '../../api/client';
import Button from '../Button';
import { Checkbox } from '../Checkbox';
import DialogShell from '../DialogShell';
import { Select } from '../Select';
import { useToast } from '../Toast';
import { useT } from '../../i18n';
import { shortenHome } from '../../lib/paths';
import { queryKeys } from '../../lib/queryKeys';
import { importLines, lineDiff, refreshInstructions, sharedNameProblem, takenName } from './instructionsView';

const METHODS: ConvertMethod[] = ['import', 'rename', 'copy'];
// The share picker's choice for a new shared file; real names are extras names.
const NEW = '\0new';

/** ② Turn a target's own file (CLAUDE.md) into an AGENTS.md other tools read, with a preview first. */
export default function ConvertDialog({ data, onClose }: { data: TargetInstructions; onClose: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<ConvertMethod>(data.convert[0]);
  const [keep, setKeep] = useState(true);
  // A user-level AGENTS.md no tool reads, so global mode shares by default.
  const [share, setShare] = useState(!data.project);
  const [shareName, setShareName] = useState('');
  const [picked, setPicked] = useState<string>();
  const [busy, setBusy] = useState(false);
  const file = (data.path ?? '').split('/').pop() ?? '';
  const tool = importLines(data.content).length;
  const sharing = share && method === 'import' && !data.project;
  const extras = useQuery({ queryKey: queryKeys.extras, queryFn: () => api.listExtras(), enabled: !data.project });
  const sharedList = useQuery({ queryKey: queryKeys.instructions.shared, queryFn: () => api.listSharedInstructions(), enabled: !data.project });
  // Files the target already uses would be imported twice.
  const available = (sharedList.data?.files ?? []).filter((f) => !data.shared.some((a) => a.name === f.name));
  const choice = picked ?? available[0]?.name ?? NEW;
  const shareReady = sharing && Boolean(sharedList.data);
  const shareInto = shareReady && choice !== NEW ? choice : undefined;
  const names = (extras.data?.extras ?? []).map((e) => e.name);
  const nameProblem = choice === NEW ? sharedNameProblem(shareName, names) : null;
  const shareAs = shareReady && choice === NEW && !nameProblem ? shareName.trim() : undefined;
  const body = { method, keep_tool_lines: keep, ...(shareAs && { share_as: shareAs }), ...(shareInto && { share_into: shareInto }) };
  const shareMissing = sharing && !shareAs && !shareInto;

  const preview = useQuery({
    queryKey: ['instructions', 'convert', data.target, body],
    queryFn: () => api.convertTargetInstructions(data.target, { ...body, apply: false }),
    // Off while applying: the refresh after success would re-plan against the
    // shared file that now exists.
    enabled: !busy && !shareMissing,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const convert = async () => {
    setBusy(true);
    try {
      await api.convertTargetInstructions(data.target, { ...body, apply: true });
      refreshInstructions(queryClient);
      toast(t('instructions.convert.done', { file }), 'success');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
      setBusy(false);
    }
  };

  const title = t('instructions.convert.title');
  return (
    <DialogShell open onClose={onClose} padding="none" preventClose={busy} ariaLabel={title} className="!max-w-[980px]">
      <div className="dh">
        <div className="flex flex-col gap-1">
          <h2 className="ss-h2">{title}</h2>
          <p className="text-[13px] text-ink-2">{t('instructions.convert.subtitle', { path: shortenHome(data.path ?? '') })}</p>
        </div>
        <button type="button" className="ss-ib" aria-label={t('common.close')} onClick={onClose} disabled={busy}><X size={16} /></button>
      </div>
      <div className="db">
        <div className="grid grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start gap-6">
          <div role="radiogroup" aria-label={t('instructions.convert.how')} className="flex flex-col gap-2.5">
            <span className="text-[13px] font-semibold">{t('instructions.convert.how')}</span>
            {METHODS.map((m) => {
              const on = method === m;
              const blocked = data.convert_blocked?.[m];
              return (
                <button key={m} type="button" role="radio" aria-checked={on} className={`ss-pick text-left ${on ? 'on' : ''} disabled:opacity-60`} onClick={() => setMethod(m)} disabled={busy || !data.convert.includes(m)}>
                  <span className={`ss-chk rad ${on ? 'on' : ''}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 font-semibold">
                      {t(`instructions.convert.method.${m}`, { file })}
                      {m === 'import' && <span className="ss-tag ok">{t('instructions.convert.recommended')}</span>}
                      {m === 'rename' && <span className="ss-tag">project only</span>}
                    </span>
                    <span className="text-[13px] text-ink-2">{t(`instructions.convert.methodHint.${m}`, { file, name: data.target })}</span>
                    {blocked && <span className="text-[12.5px] text-ink-3">{t(`instructions.convert.blocked.${blocked}`, { file, name: data.target })}</span>}
                  </span>
                </button>
              );
            })}
            {method === 'import' && tool > 0 && (
              <Checkbox size="sm" label={t(tool === 1 ? 'instructions.convert.keep.one' : 'instructions.convert.keep.other', { count: tool, file })} checked={keep} onChange={setKeep} disabled={busy} />
            )}
            {method === 'import' && !data.project && (
              <div className="flex flex-col gap-1.5">
                <Checkbox size="sm" label={t('instructions.convert.share')} checked={share} onChange={setShare} disabled={busy} />
                {!share && <span className="pl-6 text-[12.5px] text-ink-3">{t('instructions.convert.shareOff', { name: data.target })}</span>}
                {share && sharedList.data && (
                  <div className="ss-fld pl-6">
                    <Select
                      ariaLabel={t('instructions.convert.shareInto')}
                      value={choice}
                      onChange={setPicked}
                      disabled={busy}
                      options={[...available.map((f) => ({ value: f.name, label: f.name })), { value: NEW, label: t('instructions.convert.shareNew') }]}
                    />
                    {choice === NEW ? (
                      <>
                        <span className={`ss-inp ${nameProblem ? 'err' : ''}`}>
                          <input value={shareName} onChange={(e) => setShareName(e.target.value)} aria-label={t('instructions.shared.name')} disabled={busy} autoFocus />
                        </span>
                        <span className={`hp ${nameProblem ? 'text-bad' : ''}`}>{nameProblem === 'invalid' ? t('instructions.shared.nameInvalid') : nameProblem === 'taken' ? t('instructions.convert.nameTaken', { name: takenName(shareName, names) ?? shareName.trim() }) : t('instructions.convert.shareHint')}</span>
                      </>
                    ) : (
                      <span className="hp">{t('instructions.convert.shareIntoHint', { name: choice, file })}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="text-[13px] font-semibold">{t('instructions.convert.preview')}</span>
            {preview.error ? (
              <div className="ss-note bad"><span className="flex-1">{preview.error instanceof ApiError && preview.error.code === 'conflict' && shareAs ? t('instructions.convert.nameTaken', { name: shareAs }) : preview.error.message}</span></div>
            ) : shareMissing ? (
              <p className="text-[13px] text-ink-3">{t('instructions.convert.nameFirst')}</p>
            ) : (
              (preview.data?.changes ?? []).map((c) => <ChangePreview key={c.path} change={c} />)
            )}
          </div>
        </div>
      </div>
      <div className="df">
        <span className="flex-1 text-[12.5px] text-ink-3">{t('instructions.convert.backup', { file })}</span>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={convert} loading={busy} disabled={!preview.data || Boolean(preview.error) || preview.isFetching || shareMissing}>
          {t('instructions.convert.run')}
        </Button>
      </div>
    </DialogShell>
  );
}

function ChangePreview({ change }: { change: InstructionsChange }) {
  const lines = lineDiff(change.before, change.after);
  const added = lines.filter((l) => l.kind === 'add').length;
  const removed = lines.filter((l) => l.kind === 'del').length;
  const tone = change.status === 'new' ? 'ok' : change.status === 'removed' ? 'bad' : 'warn';
  return (
    <div className="ss-list !shadow-none">
      <div className="ss-lh !normal-case">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{shortenHome(change.path)}</span>
        <span className={`ss-tag ${tone}`}>{change.status}</span>
        <span className="font-mono text-[12px]">
          {added > 0 && <span className="text-ok">+{added}</span>} {removed > 0 && <span className="text-bad">−{removed}</span>}
        </span>
      </div>
      <pre className="ss-code !max-h-[220px] !rounded-none !border-0 !overflow-auto">
        {lines.map((l, i) => (
          <span key={i} className={l.kind === 'same' ? 'block' : l.kind}>{l.kind === 'add' ? '+ ' : l.kind === 'del' ? '− ' : '  '}{l.text || ' '}</span>
        ))}
      </pre>
    </div>
  );
}
