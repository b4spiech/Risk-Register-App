import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSeverity, worstSeverity } from '../lib/severity';
import type { Project, Risk } from '../lib/types';

interface ProjectRollup {
  openRiskCount: number;
  worst: ReturnType<typeof worstSeverity>;
}

function rollup(risks: Risk[]): ProjectRollup {
  const open = risks.filter((r) => r.RiskStatus !== 'Closed');
  return {
    openRiskCount: open.length,
    worst: worstSeverity(open.map((r) => getSeverity(r.Probability, r.Impact))),
  };
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.listProjects('Active'), api.listRisks()])
      .then(([p, r]) => {
        if (cancelled) return;
        setProjects(p);
        setRisks(r);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const byProject = useMemo(() => {
    const m = new Map<number, Risk[]>();
    for (const r of risks) {
      const arr = m.get(r.ProjectID) ?? [];
      arr.push(r);
      m.set(r.ProjectID, arr);
    }
    return m;
  }, [risks]);

  if (loading) return <div className="empty">Loading projects…</div>;
  if (error) return <div className="empty">Couldn't load projects: {error}</div>;
  if (projects.length === 0) return <div className="empty">No active projects.</div>;

  return (
    <>
      <div className="row-between">
        <div className="crumbs">Active projects</div>
      </div>
      <div className="grid grid-cards">
        {projects.map((p) => {
          const { openRiskCount, worst } = rollup(byProject.get(p.ID) ?? []);
          return (
            <div
              key={p.ID}
              className="card project-card"
              onClick={() => navigate(`/projects/${p.ID}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/projects/${p.ID}`);
              }}
            >
              <h3>{p.Title}</h3>
              <div className="stats">
                <span>{openRiskCount} open risk{openRiskCount === 1 ? '' : 's'}</span>
                {worst && (
                  <span className={`chip ${worst.toLowerCase()}`}>{worst}</span>
                )}
                {!worst && <span className="chip muted">No open risks</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
