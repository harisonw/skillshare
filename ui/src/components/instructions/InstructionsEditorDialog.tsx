import { useRef, useState } from 'react';
import { useBeforeUnload } from 'react-router-dom';
import { TriangleAlert, X } from 'lucide-react';
import AgentIcon from '../AgentIcon';
import Button from '../Button';
import CodeEditor from '../CodeEditor';
import ConfirmDialog from '../ConfirmDialog';
import DialogShell from '../DialogShell';
import { useToast } from '../Toast';
import { useT } from '../../i18n';
import { shortenHome } from '../../lib/paths';
import { useSaveShortcut } from './useSaveShortcut';
import { BoxHeader, InstructionsPreview } from './ViewTabs';
import { instructionsErrorMessage, isImportLine } from './instructionsView';

/** Edits one instruction file in place: a shared file or the project AGENTS.md. */
export default function InstructionsEditorDialog({ title, path, content, note, readers, warnings, onSave, onClose }: {
  title: string;
  path: string;
  content: string;
  /** Shown in the side panel, e.g. who else reads the file. */
  note?: string;
  /** Targets that read the saved file directly. */
  readers?: string[];
  /** Problems the side panel should point out, e.g. targets that read only part of the file. */
  warnings?: string[];
  /** Resolves to the toast text when the save did more than write the file. */
  onSave: (content: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [base, setBase] = useState(content);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  // Preview shows the draft; the draft and ⌘S work the same in both views.
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const dirty = draft !== base;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const message = await onSave(draft);
      setBase(draft);
      toast(message || t('instructions.saved', { path: shortenHome(path) }), 'success');
    } catch (err) {
      toast(instructionsErrorMessage(err, t), 'error');
    } finally {
      setSaving(false);
    }
  };
  const scope = useRef<HTMLDivElement>(null);
  useSaveShortcut(() => void save(), true, scope);
  useBeforeUnload((e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  // ✕, Esc and the backdrop ask before an unsaved edit is dropped.
  const close = () => (dirty ? setDiscarding(true) : onClose());

  return (
    <DialogShell open onClose={close} maxWidth="full" padding="none" preventClose={saving || reverting || discarding} ariaLabel={title}>
      <div ref={scope} className="dh">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="ss-h2 font-mono">{title}</h2>
          <span className="truncate font-mono text-[12.5px] text-ink-3">{shortenHome(path)}</span>
        </div>
        <button type="button" className="ss-ib" aria-label={t('common.close')} onClick={close} disabled={saving}><X size={16} /></button>
      </div>
      <div className="db">
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
          <div className="ss-code flex h-[calc(100vh-16rem)] min-w-0 flex-col !overflow-hidden !p-0 !whitespace-normal focus-within:!border-[var(--accent)]">
            <BoxHeader content={draft} view={view} onChange={setView} />
            {view === 'edit' ? (
              <CodeEditor value={draft} onChange={setDraft} ariaLabel={title} markLine={isImportLine} disabled={saving} wrap fill className="min-h-0 flex-1 !rounded-none !border-0" />
            ) : (
              <InstructionsPreview content={draft} names={[]} />
            )}
          </div>
          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className={`ss-st ${dirty ? 'warn' : 'off'}`}>{t(dirty ? 'instructions.editor.modified' : 'instructions.editor.unchanged')}</span>
            </div>
            {readers && readers.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-2">{t('instructions.editor.readers')}</span>
                {readers.map((name) => (
                  <span key={name} className="flex items-center gap-2.5">
                    <span className="ss-at !h-6 !w-6"><AgentIcon target={name} size={14} /></span>
                    <span className="font-mono text-[13px] font-semibold">{name}</span>
                  </span>
                ))}
              </div>
            )}
            {warnings?.map((w) => <div key={w} className="ss-note warn"><TriangleAlert size={16} /><span className="flex-1">{w}</span></div>)}
            {note && <p className="text-[12.5px] text-ink-3">{note}</p>}
          </aside>
        </div>
      </div>
      <div className="df">
        <span className="flex-1 text-[12.5px] text-ink-3">{t('instructions.editor.saveHint')}</span>
        <Button variant="ghost" onClick={() => setReverting(true)} disabled={!dirty || saving}>{t('config.revert')}</Button>
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>{t('common.save')}</Button>
      </div>
      <ConfirmDialog
        open={reverting}
        title={t('config.revert.title')}
        message={t('config.revert.message')}
        confirmText={t('config.revert.confirmText')}
        variant="danger"
        onCancel={() => setReverting(false)}
        onConfirm={() => { setDraft(base); setReverting(false); }}
      />
      <ConfirmDialog
        open={discarding}
        title={t('config.discard.title')}
        message={t('config.discard.message')}
        confirmText={t('config.discard.confirmText')}
        variant="danger"
        onCancel={() => setDiscarding(false)}
        onConfirm={() => { setDiscarding(false); onClose(); }}
      />
    </DialogShell>
  );
}
