import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import RiskCard from '../components/RiskCard';
import RiskForm from '../components/RiskForm';
import RiskHeatmap from '../components/RiskHeatmap';
import ViewTabs, { type ViewTab } from '../components/ViewTabs';
import { api } from '../lib/api';
import { getScore } from '../lib/severity';
import type { Project, Risk, RiskCreatePayload } from '../lib/types';

function applyViewTab(risks: Risk[], tab: ViewTab): Risk[] {
  switch (tab) {
    case 'Active':
      return risks.filter((r) => r.RiskStatus === 'Active');
    case 'Monitoring':
      return risks.filter((r) => r.RiskStatus === 'Monitoring');
    case 'Mitigated':
      return risks.filter((r) => r.PMOAction === 'Mitigate');
    case 'Closed':
      return risks.filter((r) => r.RiskStatus === 'Closed');
    case 'All':
    default:
      return risks;
  }
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<ViewTab>('All');
  const [cellFilter, setCellFilter] = useState<{ probability: number; impact: number } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([api.listProjects(), api.listRisks(pid)])
      .then(([allProjects, projectRisks]) => {
        setProjects(allProjects);
        setProject(allProjects.find((p) => p.ID === pid) ?? null);
        setRisks(projectRisks);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [pid]);

  // Re-fetch just risks (no full-screen loading spinner) — used after
  // a successful create so the new card can appear in place.
  const reloadRisks = useCallback(async (): Promise<Risk[]> => {
    const rs = await api.listRisks(pid);
    setRisks(rs);
    return rs;
  }, [pid]);

  useEffect(() => {
    reload();
  }, [reload]);

  // tab filter affects both heatmap counts and cards
  const tabFiltered = useMemo(() => applyViewTab(risks, tab), [risks, tab]);

  const cardRisks = useMemo(() => {
    const base = cellFilter
      ? tabFiltered.filter(
          (r) =>
            r.Probability === cellFilter.probability && r.Impact === cellFilter.impact,
        )
      : tabFiltered;
    return [...base].sort(
      (a, b) => getScore(b.Probability, b.Impact) - getScore(a.Probability, a.Impact),
    );
  }, [tabFiltered, cellFilter]);

  // when tab changes, clear any cell selection
  useEffect(() => {
    setCellFilter(null);
  }, [tab]);

  async function handleSubmit(payload: RiskCreatePayload) {
    await api.createRisk(payload);
    const matches = (rs: Risk[]) =>
      rs.some((r) => r.Title === payload.Title && r.ProjectID === payload.ProjectID);

    // First re-fetch usually wins; if SharePoint hasn't reflected the
    // write yet, wait briefly and retry exactly once. Avoid hammering.
    let fresh = await reloadRisks();
    if (!matches(fresh)) {
      await new Promise((r) => setTimeout(r, 1200));
      fresh = await reloadRisks();
    }

    if (matches(fresh)) {
      setFlash('Risk created.');
    } else if (payload.ProjectID !== pid) {
      setFlash(
        `Risk created under a different project (id ${payload.ProjectID}); switch to that project to see it.`,
      );
    } else {
      setFlash("Risk created. SharePoint hasn't reflected it yet — refresh in a moment.");
    }
  }

  if (loading) return <div className="empty">Loading…</div>;
  if (error) return <div className="empty">Couldn't load project: {error}</div>;
  if (!project) {
    return (
      <div className="empty">
        Project not found. <Link to="/projects">Back to projects</Link>
      </div>
    );
  }

  return (
    <>
      <div className="row-between">
        <div>
          <div className="crumbs">
            <Link to="/projects">Projects</Link> / <span>{project.Title}</span>
          </div>
          <h2 style={{ margin: '4px 0 0 0' }}>{project.Title}</h2>
        </div>
        <button
          className="primary"
          onClick={() => setFormOpen(true)}
        >
          + New risk
        </button>
      </div>

      <ViewTabs value={tab} onChange={setTab} />

      <div className="card" style={{ marginBottom: 16 }}>
        <RiskHeatmap risks={tabFiltered} selected={cellFilter} onSelect={setCellFilter} />
        {cellFilter && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button onClick={() => setCellFilter(null)}>
              Clear cell filter (P{cellFilter.probability} × I{cellFilter.impact})
            </button>
          </div>
        )}
      </div>

      {cardRisks.length === 0 ? (
        <div className="empty">No risks match the current filter.</div>
      ) : (
        <div className="grid grid-cards">
          {cardRisks.map((r) => (
            <RiskCard key={r.ID} risk={r} />
          ))}
        </div>
      )}

      <RiskForm
        open={formOpen}
        projects={projects.filter((p) => p.ProjectStatus === 'Active')}
        defaultProjectId={pid}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      {flash && (
        <div className="flash" role="status" onClick={() => setFlash(null)}>
          {flash}
        </div>
      )}
    </>
  );
}
