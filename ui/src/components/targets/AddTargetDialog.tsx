import { useState } from 'react';
import { ArrowLeft, Check, ChevronDown, FileText, Folder, FolderPlus, Plus, Search, Users, X } from 'lucide-react';
import { api, type AvailableTarget } from '../../api/client';
import { useAppContext } from '../../context/AppContext';
import { shortenHome } from '../../lib/paths';
import { useT } from '../../i18n';
import AgentIcon from '../AgentIcon';
import Button from '../Button';
import DialogShell from '../DialogShell';
import { Checkbox } from '../Input';
import { setupPathProblem } from '../instructions/instructionsView';

const PREVIEW_COUNT = 5;

function FolderField({ id, label, value, onChange, hint, placeholder, disabled }: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint: string; placeholder?: string; disabled: boolean;
}) {
  return (
    <div className="ss-fld">
      <label htmlFor={id}>{label}</label>
      <span className="ss-inp">
        <Folder size={15} className="shrink-0 text-ink-3" />
        <input id={id} className="font-mono" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
      </span>
      <span className="hp">{hint}</span>
    </div>
  );
}

/** Pick a known tool (defaults filled from targets.yaml), describe a custom one, or add another account of a known one. */
export default function AddTargetDialog({ available, initial, existing, onClose, onAdded }: {
  available: AvailableTarget[];
  initial?: string;
  existing: string[];
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const t = useT();
  const { isProjectMode } = useAppContext();
  const pool = available.filter((a) => !a.installed).sort((a, b) => a.name.localeCompare(b.name));
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [mode, setMode] = useState<'known' | 'custom' | 'account'>('known');
  const custom = mode !== 'known';
  // Another account is another config folder of an Agent; its paths follow the folder.
  const accountAgents = available.filter((a) => a.configDir).sort((a, b) => a.name.localeCompare(b.name));
  const [account, setAccount] = useState({ agent: accountAgents[0]?.name ?? '', dir: '', named: false });
  const [draft, setDraft] = useState(() => {
    const first = pool.find((a) => a.name === initial) ?? pool.find((a) => a.detected);
    return { name: first?.name ?? '', path: first?.path ?? '', agentPath: first?.agentPath ?? '' };
  });
  // A custom tool's instruction file, so its file tab works right after adding it.
  const [instructions, setInstructions] = useState({ path: '', import: false });
  const instructionsProblem = mode === 'custom' ? setupPathProblem(instructions.path, isProjectMode) : null;
  const instructionsExample = `${isProjectMode ? '' : '~/'}.${draft.name.trim() || 'my-tool'}/AGENTS.md`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const q = query.trim().toLowerCase();
  const matches = q ? pool.filter((a) => a.name.toLowerCase().includes(q)) : pool;
  const found = matches.filter((a) => a.detected);
  const others = matches.filter((a) => !a.detected);
  const shownOthers = q || showAll ? others : others.slice(0, PREVIEW_COUNT);
  const known = pool.find((a) => a.name === draft.name);

  const taken = custom && existing.includes(draft.name.trim());
  const accountAgent = accountAgents.find((a) => a.name === account.agent);
  const dir = account.dir.trim().replace(/[\\/]+$/, '');
  const moved = (path?: string) => (path && accountAgent?.configDir && dir && path.startsWith(accountAgent.configDir) ? dir + path.slice(accountAgent.configDir.length) : '');
  // Codex reads the shared ~/.agents/skills, outside its config folder; an account's skills
  // are always in its own folder.
  const accountSkills = dir && accountAgent ? moved(accountAgent.path) || `${dir}/skills` : '';
  const canAdd = Boolean(draft.name.trim()) && !taken && !instructionsProblem && (mode === 'account' ? Boolean(dir && accountAgent) : Boolean(draft.path.trim()) && (custom || Boolean(known)));
  const add = async () => {
    const name = draft.name.trim();
    setBusy(true);
    setError('');
    try {
      if (mode === 'account') await api.addAgentConfigDir(name, account.agent, dir);
      else await api.addTarget(name, draft.path.trim(), draft.agentPath.trim() || undefined, mode === 'custom' && instructions.path.trim() ? { path: instructions.path.trim(), import: instructions.import } : undefined);
      onAdded(name);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  const open = (next: typeof mode) => {
    setMode(next);
    setError('');
    setDraft({ name: '', path: '', agentPath: '' });
    setInstructions({ path: '', import: false });
    setAccount({ agent: accountAgents[0]?.name ?? '', dir: '', named: false });
  };
  // The name follows the folder (~/.claude-work gives claude-work) until it is typed.
  const setDir = (value: string) => {
    setAccount({ ...account, dir: value });
    if (!account.named) setDraft({ ...draft, name: value.trim().replace(/[\\/]+$/, '').split(/[\\/]/).pop()!.replace(/^\.+/, '') });
  };

  const row = (a: AvailableTarget) => {
    const on = !custom && draft.name === a.name;
    return (
      <div key={a.name} className={`ss-r !block !p-0 ${on ? 'sel' : ''}`}>
        <button
          type="button"
          role="radio"
          aria-checked={on}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
          onClick={() => setDraft({ name: a.name, path: a.path, agentPath: a.agentPath ?? '' })}
          disabled={busy}
        >
          <span className={`ss-chk rad ${on ? 'on' : ''}`} />
          <span className="ss-at"><AgentIcon target={a.name} size={17} /></span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{a.name}</span>
            <span className="truncate font-mono text-[12px] text-ink-3">{shortenHome(a.path)}</span>
          </span>
        </button>
        {on && (
          <div className="flex flex-col gap-3 pb-4 pl-[88px] pr-4">
            <FolderField
              id="target-path"
              label={t('targets.add.skillsFolder')}
              value={draft.path}
              onChange={(path) => setDraft({ ...draft, path })}
              hint={a.detected ? t('targets.add.detectedHint', { name: a.name }) : t('targets.add.createdHint')}
              disabled={busy}
            />
            {a.agentPath && (
              <FolderField
                id="target-agent-path"
                label={t('targets.add.agentsFolder')}
                value={draft.agentPath}
                onChange={(agentPath) => setDraft({ ...draft, agentPath })}
                hint={t('targets.add.agentsHint')}
                disabled={busy}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const title = t({ known: 'targets.add.title', custom: 'targets.add.customTitle', account: 'targets.add.accountTitle' }[mode]);
  const subtitle = t({ known: 'targets.add.subtitle', custom: 'targets.add.customSubtitle', account: 'targets.add.accountSubtitle' }[mode]);
  const nameField = (
    <div className="ss-fld">
      <label htmlFor="target-name">{t('targets.add.name')}</label>
      <span className={`ss-inp ${taken ? 'err' : ''}`}>
        <input id="target-name" autoFocus={mode === 'custom'} value={draft.name} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setAccount({ ...account, named: true }); }} placeholder={mode === 'account' ? `${account.agent}-work` : 'my-tool'} disabled={busy} />
      </span>
      <span className={`hp ${taken ? '!text-bad' : ''}`}>{taken ? t('targets.add.nameTaken') : t('targets.add.nameHint')}</span>
    </div>
  );
  return (
    <DialogShell open onClose={onClose} padding="none" preventClose={busy} ariaLabel={title} className="!max-w-[600px]">
      <div className="dh">
        <div className="flex flex-col gap-1">
          <h2 className="ss-h2">{title}</h2>
          <p className="text-[13px] text-ink-2">{subtitle}</p>
        </div>
        <button type="button" className="ss-ib" aria-label={t('common.close')} onClick={onClose} disabled={busy}><X size={16} /></button>
      </div>
      <form id="add-target" className="db" onSubmit={(e) => { e.preventDefault(); if (canAdd) void add(); }}>
        {mode === 'account' ? (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-3" role="radiogroup" aria-label={t('targets.add.accountAgent')}>
              {accountAgents.map((a) => (
                <button key={a.name} type="button" role="radio" aria-checked={a.name === account.agent} aria-label={a.name} className={`ss-tgl ${a.name === account.agent ? 'on' : ''}`} onClick={() => setAccount({ ...account, agent: a.name })} disabled={busy}>
                  <span className="ic"><AgentIcon target={a.name} size={20} /><i><Check size={9} strokeWidth={3.5} /></i></span>
                  {a.name}
                </button>
              ))}
            </div>
            <FolderField id="target-config-dir" label={t('targets.add.accountFolder')} value={account.dir} onChange={setDir} placeholder={accountAgent ? `${shortenHome(accountAgent.configDir!)}-work` : ''} hint={t('targets.add.accountFolderHint', { name: account.agent })} disabled={busy} />
            {nameField}
            {dir && (
              <div className="ss-note inf">
                <span className="flex flex-1 flex-col gap-1">
                  <span>{t('targets.add.accountWrites')}</span>
                  {[accountSkills, moved(accountAgent?.agentPath)].filter(Boolean).map((path) => <span key={path} className="break-all font-mono text-[12px]">{path}</span>)}
                </span>
              </div>
            )}
          </>
        ) : custom ? (
          <>
            {nameField}
            <FolderField id="target-path" label={t('targets.add.skillsFolder')} value={draft.path} onChange={(path) => setDraft({ ...draft, path })} placeholder="~/tools/my-tool/skills" hint={t('targets.add.customSkillsHint')} disabled={busy} />
            <FolderField id="target-agent-path" label={t('targets.add.agentsFolder')} value={draft.agentPath} onChange={(agentPath) => setDraft({ ...draft, agentPath })} placeholder={t('targets.add.optional')} hint={t('targets.add.customAgentsHint')} disabled={busy} />
            <div className="ss-fld">
              <label htmlFor="target-instructions">{t('targets.add.instructionsFile')}</label>
              <span className={`ss-inp ${instructionsProblem ? 'err' : ''}`}>
                <FileText size={15} className="shrink-0 text-ink-3" />
                <input id="target-instructions" className="font-mono" value={instructions.path} onChange={(e) => setInstructions({ ...instructions, path: e.target.value })} placeholder={instructionsExample} spellCheck={false} autoComplete="off" disabled={busy} />
              </span>
              <span className={`hp ${instructionsProblem ? '!text-bad' : ''}`}>
                {instructionsProblem ? t(`instructions.setup.problem.${instructionsProblem}`) : t(isProjectMode ? 'targets.add.instructionsHintProject' : 'targets.add.instructionsHint')}
              </span>
            </div>
            {instructions.path.trim() && <Checkbox label={t('instructions.setup.import')} checked={instructions.import} onChange={(v) => setInstructions({ ...instructions, import: v })} size="sm" disabled={busy} />}
            <div className="ss-note inf"><span className="flex-1">{t('targets.add.createdHint')}</span></div>
          </>
        ) : (
          <>
            <span className="ss-inp">
              <Search size={15} className="shrink-0 text-ink-3" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} placeholder={t('targets.add.search', { count: pool.length })} aria-label={t('targets.add.search', { count: pool.length })} />
            </span>
            <div className="ss-list max-h-[440px] overflow-y-auto !shadow-none" role="radiogroup" aria-label={t('targets.add.title')}>
              {found.length > 0 && (
                <>
                  <div className="ss-gh text-ink-2"><span className="flex-1">{t('targets.foundOnMachine')}</span><span className="text-ink-3">{found.length}</span></div>
                  {found.map(row)}
                </>
              )}
              {others.length > 0 && (
                <>
                  <div className="ss-gh text-ink-2"><span className="flex-1">{t('targets.add.allTools')}</span><span className="text-ink-3">{others.length}</span></div>
                  {shownOthers.map(row)}
                  {shownOthers.length < others.length && (
                    <button type="button" className="ss-r !min-h-10 w-full text-[13px] text-ink-2 hover:text-ink" onClick={() => setShowAll(true)}>
                      <span className="flex-1 text-left">{t('targets.add.moreTools', { count: others.length - shownOthers.length })}</span>
                      <ChevronDown size={15} />
                    </button>
                  )}
                </>
              )}
              {matches.length === 0 && (
                <div className="ss-r text-[13px] text-ink-2">{q ? t('targets.add.noMatch', { query: query.trim() }) : t('targets.add.allAdded')}</div>
              )}
            </div>
            <button type="button" className="flex w-fit items-center gap-2 text-[13px] font-semibold hover:text-accent" onClick={() => open('custom')} disabled={busy}>
              <FolderPlus size={15} />
              {t('targets.add.customLink')}
            </button>
            {accountAgents.length > 0 && (
              <button type="button" className="flex w-fit items-center gap-2 text-[13px] font-semibold hover:text-accent" onClick={() => open('account')} disabled={busy}>
                <Users size={15} />
                {t('targets.add.accountLink')}
              </button>
            )}
          </>
        )}
        {error && <div className="ss-note bad"><span className="flex-1">{error}</span></div>}
      </form>
      <div className="df">
        {custom ? (
          <Button variant="ghost" onClick={() => open('known')} disabled={busy}><ArrowLeft size={15} />{t('targets.add.back')}</Button>
        ) : (
          <span className="text-[13px] text-ink-2">{t('targets.add.modeHint')}</span>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
        <Button variant="primary" type="submit" form="add-target" loading={busy} disabled={!canAdd}>
          {!busy && <Plus size={15} />}
          {mode === 'custom' || !draft.name.trim() ? t('targets.addTarget') : t('targets.add.addNamed', { name: draft.name.trim() })}
        </Button>
      </div>
    </DialogShell>
  );
}
