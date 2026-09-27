import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Folder, Target as TargetIcon } from 'lucide-react';
import { api, type Target } from '../api/client';
import { mcpApi } from '../api/mcp';
import Button from '../components/Button';
import CollectDialog from '../components/CollectDialog';
import EmptyState from '../components/EmptyState';
import { Select } from '../components/Input';
import PageHeader from '../components/PageHeader';
import SegmentedControl from '../components/SegmentedControl';
import { PageSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import FilterSection, { ModePicker } from '../components/targets/FilterSection';
import RemoveTargetDialog from '../components/targets/RemoveTargetDialog';
import TargetMCP from '../components/targets/TargetMCP';
import TargetInstructions from '../components/instructions/TargetInstructions';
import { mcpClient, serverCount } from '../components/mcp/mcpView';
import { refreshTargets } from '../components/targets/targetView';
import { queryKeys, staleTimes } from '../lib/queryKeys';
import { shortenHome } from '../lib/paths';
import { useT } from '../i18n';

type Kind = 'skill' | 'agent';
const draftOf = (target: Target) => ({
  include: target.include ?? [], exclude: target.exclude ?? [], mode: target.mode || 'merge', naming: target.targetNaming || 'flat',
  agentInclude: target.agentInclude ?? [], agentExclude: target.agentExclude ?? [], agentMode: target.agentMode || 'merge',
  agentExtension: target.agentExtension ?? '',
});
type Draft = ReturnType<typeof draftOf>;
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function TargetDetailPage() {
  const { name = '' } = useParams();
  const t = useT();
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.targets.all, queryFn: () => api.listTargets(), staleTime: staleTimes.targets });
  const target = data?.targets.find((x) => x.name === name);

  if (isPending) return <PageSkeleton />;
  if (error) return <div className="ss-note bad"><span className="flex-1">{error.message}</span></div>;
  if (!target) {
    return (
      <EmptyState
        icon={TargetIcon}
        title={t('targetDetail.notFound', { name })}
        action={<Link to="/targets"><Button variant="secondary">{t('targetDetail.backToTargets')}</Button></Link>}
      />
    );
  }
  return <TargetEditor key={name} target={target} />;
}

function TargetEditor({ target }: { target: Target }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const mcp = useQuery({ queryKey: queryKeys.mcp, queryFn: mcpApi.list });
  // Only an Agent that has an MCP file in this scope (global, or the -p project) gets the tab.
  const client = mcpClient(target.name);
  const mcpPath = mcp.data?.paths[client];
  // Until the list arrives, loading or failing, the tab stays so it can say which.
  const tab: Kind | 'mcp' | 'instructions' = params.get('tab') === 'instructions' ? 'instructions'
    : target.agentPath && params.get('tab') === 'agents' ? 'agent' : params.get('tab') === 'mcp' && (mcpPath || !mcp.data) ? 'mcp' : 'skill';
  const kind: Kind = tab === 'agent' ? 'agent' : 'skill';
  const tabs = (['skill', 'agent', 'mcp', 'instructions'] as const).filter((k) => k === 'skill' || k === 'instructions' || (k === 'agent' ? target.agentPath : mcpPath || tab === 'mcp'));
  const instructions = useQuery({ queryKey: queryKeys.instructions.target(target.name), queryFn: () => api.getTargetInstructions(target.name) });
  const syncTab = tab === 'skill' || tab === 'agent';
  const saved = draftOf(target);
  const [draft, setDraft] = useState<Draft>(saved);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const { data: extData } = useQuery({ queryKey: ['extras', 'extensions'], queryFn: () => api.listExtraExtensions(), staleTime: staleTimes.extras, enabled: syncTab });
  const extensions = extData?.extensions ?? [];

  // Preview the draft filters once typing settles.
  const [filters, setFilters] = useState(draft);
  useEffect(() => {
    const id = setTimeout(() => setFilters(draft), 400);
    return () => clearTimeout(id);
  }, [draft]);
  const preview = useQuery({
    queryKey: ['sync-matrix-preview', target.name, filters.include, filters.exclude, filters.agentInclude, filters.agentExclude],
    queryFn: () => api.previewSyncMatrix(target.name, filters.include, filters.exclude, filters.agentInclude, filters.agentExclude),
    placeholderData: keepPreviousData,
  });
  const entriesOf = (k: Kind) => (preview.data?.entries ?? []).filter((e) => (e.kind === 'agent') === (k === 'agent') && e.status !== 'na');
  const entries = entriesOf(kind);

  const payload: Parameters<typeof api.updateTarget>[1] = {
    ...(!same(draft.include, saved.include) && { include: draft.include }),
    ...(!same(draft.exclude, saved.exclude) && { exclude: draft.exclude }),
    ...(draft.mode !== saved.mode && { mode: draft.mode }),
    ...(draft.naming !== saved.naming && { target_naming: draft.naming }),
    ...(!same(draft.agentInclude, saved.agentInclude) && { agent_include: draft.agentInclude }),
    ...(!same(draft.agentExclude, saved.agentExclude) && { agent_exclude: draft.agentExclude }),
    ...(draft.agentMode !== saved.agentMode && { agent_mode: draft.agentMode }),
    ...(draft.agentExtension !== saved.agentExtension && { agent_extension: draft.agentExtension }),
  };
  const dirty = Object.keys(payload).length > 0;
  const save = async () => {
    setSaving(true);
    try {
      await api.updateTarget(target.name, payload);
      refreshTargets(queryClient);
      toast(t('targetDetail.saved', { name: target.name }), 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const agent = kind === 'agent';
  const include = agent ? draft.agentInclude : draft.include;
  const exclude = agent ? draft.agentExclude : draft.exclude;
  const mode = agent ? draft.agentMode : draft.mode;
  const setFiltersFor = (next: { include: string[]; exclude: string[] }) =>
    setDraft(agent ? { ...draft, agentInclude: next.include, agentExclude: next.exclude } : { ...draft, ...next });
  const local = agent ? target.agentLocalCount ?? 0 : target.localCount;

  const tabCount = (k: (typeof tabs)[number]) =>
    (k === 'mcp' ? mcp.data && serverCount(mcp.data, client)
      : k === 'instructions' ? instructions.data?.read_order.filter((e) => e.read).length
        : entriesOf(k).length) || null;
  // Name the tab after the file this target actually reads (CLAUDE.md, GEMINI.md, …).
  const instructionsTab = instructions.data?.supported && instructions.data.path ? instructions.data.path.split('/').pop() : 'AGENTS.md';
  const subtitle = tab === 'mcp' ? mcpPath ?? '' : tab === 'instructions' ? instructions.data?.path ?? '' : agent ? target.agentPath ?? '' : target.path;
  return (
    <div className="animate-fade-in">
      <PageHeader
        crumbs={[{ label: t('targets.title'), to: '/targets' }, { label: target.name }]}
        title={target.name}
        subtitle={<span className="font-mono">{shortenHome(subtitle)}</span>}
        actions={
          <>
            {tab === 'skill' && <Link to={`/skills?tab=analyze&target=${encodeURIComponent(target.name)}`} className="ss-btn ghost">{t('analyze.open')}</Link>}
            <Button variant="ghost" onClick={() => setRemoving(true)}>{t('targetDetail.remove')}</Button>
            {/* A switch on the MCP tab saves as it flips; the instructions tab saves its own file. */}
            {syncTab && <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>{t('common.save')}</Button>}
          </>
        }
      />

      {tabs.length > 1 && (
        <nav className="ss-tabs mb-7" aria-label={t('targetDetail.tabs')}>
          {tabs.map((k) => (
            <Link key={k} to={k === 'agent' ? '?tab=agents' : k === 'mcp' ? '?tab=mcp' : k === 'instructions' ? '?tab=instructions' : '?'} replace className={tab === k ? 'on' : ''}>
              {k === 'agent' ? 'Agents' : k === 'mcp' ? 'MCP' : k === 'instructions' ? instructionsTab : 'Skills'}
              {tabCount(k) !== null && <span className="ss-cnt">{tabCount(k)}</span>}
            </Link>
          ))}
        </nav>
      )}

      {tab === 'instructions' ? (
        <TargetInstructions name={target.name} />
      ) : tab === 'mcp' ? (
        mcp.data ? <TargetMCP name={client} data={mcp.data} /> : mcp.error ? <div className="ss-note bad"><span className="flex-1">{mcp.error.message}</span></div> : <PageSkeleton />
      ) : (
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-12">
          <section className="flex flex-col gap-5">
            <h2 className="ss-h2">{t('targetDetail.whatSyncs')}</h2>
            <FilterSection kind={kind} mode={mode} name={target.name} include={include} exclude={exclude} onChange={setFiltersFor} entries={entries} loaded={Boolean(preview.data)} loading={preview.isPending} error={preview.error} disabled={saving} />
          </section>

          <aside className="flex flex-col gap-7">
            {agent && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{t('targetDetail.agentsFolder')}</span>
                <span className="flex items-center gap-2 font-mono text-[13px]"><Folder size={15} className="shrink-0 text-ink-3" />{shortenHome(target.agentPath ?? '')}</span>
                <span className="text-[12.5px] text-ink-3">{t('targetDetail.agentsFolderHint')}</span>
              </div>
            )}
            {agent && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{t('extras.modal.colExtension')}</span>
                <Select
                  value={draft.agentExtension}
                  // An extension converts each agent, so it always writes copies
                  onChange={(v) => setDraft({ ...draft, agentExtension: v, ...(v ? { agentMode: 'copy' } : {}) })}
                  options={[
                    { value: '', label: t('extras.noExtension') },
                    ...[...new Set([...extensions, ...(draft.agentExtension ? [draft.agentExtension] : [])])].map((e) => ({ value: e, label: e })),
                  ]}
                  disabled={saving || (extensions.length === 0 && !draft.agentExtension)}
                />
                <span className="text-[12.5px] text-ink-3">
                  {t('extras.hint.extension')}{' '}
                  {extensions.length === 0 && <Link to="/config?tab=extensions" className="font-semibold text-ink-2 hover:text-ink">{t('extras.installExtensionHint')}</Link>}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <h2 className="ss-h2">{t('targetDetail.syncMode')}</h2>
              <ModePicker kind={kind} mode={mode} onChange={(m) => setDraft(agent ? { ...draft, agentMode: m } : { ...draft, mode: m })} disabled={saving || (agent && draft.agentExtension !== '')} />
            </div>

            {!agent && draft.mode !== 'symlink' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold">{t('targetDetail.naming')}</span>
                    <span className="text-[13px] text-ink-2">{t(draft.naming === 'standard' ? 'targetDetail.namingStandard' : 'targetDetail.namingFlat')}</span>
                  </div>
                  <SegmentedControl value={draft.naming} onChange={(naming) => setDraft({ ...draft, naming })} options={[{ value: 'flat', label: 'flat' }, { value: 'standard', label: 'standard' }]} />
                </div>
                {saved.naming === 'standard' && (target.skippedSkillCount ?? 0) > 0 && (
                  <span className="text-[13px] text-warn">{t(target.skippedSkillCount === 1 ? 'targetDetail.skipped.one' : 'targetDetail.skipped.other', { count: target.skippedSkillCount })}</span>
                )}
              </div>
            )}

            {local > 0 && (
              <div className="ss-box flex flex-col gap-3">
                <span className="flex items-center gap-2 font-semibold"><ArrowDownToLine size={16} />{t('targetDetail.collect')}</span>
                <p className="text-[13px] text-ink-2">{t(`targetDetail.collectHint.${agent ? 'agents' : 'skills'}.${local === 1 ? 'one' : 'other'}`, { count: local })}</p>
                <Button variant="secondary" onClick={() => setCollecting(true)}>
                  {t(`collectDialog.run.${kind}.${local === 1 ? 'one' : 'other'}`, { count: local })}
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}

      {removing && (
        <RemoveTargetDialog
          target={target}
          onClose={() => setRemoving(false)}
          onRemoved={(warnings) => {
            refreshTargets(queryClient);
            toast(t('targets.targetRemoved', { name: target.name }), 'success');
            warnings.forEach((warning) => toast(warning, 'warning'));
            navigate('/targets');
          }}
        />
      )}
      {collecting && <CollectDialog target={target.name} kind={kind} onClose={() => setCollecting(false)} />}
    </div>
  );
}
