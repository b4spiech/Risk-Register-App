import { useEffect, useMemo, useState } from 'react';
import { getScore, getSeverity } from '../lib/severity';
import type { Project, RiskCreatePayload } from '../lib/types';

interface Props {
  open: boolean;
  projects: Project[];
  defaultProjectId?: number;
  onClose: () => void;
  onSubmit: (payload: RiskCreatePayload) => Promise<void>;
}

const SCALE = [1, 2, 3, 4, 5];

interface FormState {
  Title: string;
  RiskDescription: string;
  ProjectID: number | null;
  Probability: number | null;
  Impact: number | null;
}

const EMPTY: FormState = {
  Title: '',
  RiskDescription: '',
  ProjectID: null,
  Probability: null,
  Impact: null,
};

function validate(s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.Title.trim()) e.Title = 'Required';
  if (!s.RiskDescription.trim()) e.RiskDescription = 'Required';
  if (s.ProjectID == null) e.ProjectID = 'Pick a project';
  if (s.Probability == null) e.Probability = 'Pick a value 1–5';
  if (s.Impact == null) e.Impact = 'Pick a value 1–5';
  return e;
}

function buildPayload(s: FormState): RiskCreatePayload {
  return {
    Title: s.Title.trim(),
    RiskDescription: s.RiskDescription.trim(),
    ProjectID: s.ProjectID!,
    Probability: s.Probability!,
    Impact: s.Impact!,
  };
}

export default function RiskForm({
  open,
  projects,
  defaultProjectId,
  onClose,
  onSubmit,
}: Props) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState({ ...EMPTY, ProjectID: defaultProjectId ?? null });
    setErrors({});
  }, [open, defaultProjectId]);

  const preview = useMemo(() => {
    if (state.Probability == null || state.Impact == null) return null;
    return {
      score: getScore(state.Probability, state.Impact),
      band: getSeverity(state.Probability, state.Impact),
    };
  }, [state.Probability, state.Impact]);

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate(state);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(buildPayload(state));
      onClose();
    } catch (err) {
      setErrors({ _form: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New risk</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Risk name</label>
              <input
                value={state.Title}
                onChange={(e) => update('Title', e.target.value)}
                placeholder="Short, specific risk title"
              />
              {errors.Title && <span className="error">{errors.Title}</span>}
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={3}
                value={state.RiskDescription}
                onChange={(e) => update('RiskDescription', e.target.value)}
              />
              {errors.RiskDescription && <span className="error">{errors.RiskDescription}</span>}
            </div>
            <div className="field">
              <label>Project</label>
              <select
                value={state.ProjectID ?? ''}
                onChange={(e) =>
                  update('ProjectID', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.ID} value={p.ID}>
                    {p.Title}
                  </option>
                ))}
              </select>
              {errors.ProjectID && <span className="error">{errors.ProjectID}</span>}
            </div>
            <div className="field">
              <label>Probability (1 = won't happen, 5 = will happen)</label>
              <div className="row">
                {SCALE.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={state.Probability === n ? 'selected' : ''}
                    onClick={() => update('Probability', n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {errors.Probability && <span className="error">{errors.Probability}</span>}
            </div>
            <div className="field">
              <label>Impact (1 = none, 5 = catastrophic)</label>
              <div className="row">
                {SCALE.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={state.Impact === n ? 'selected' : ''}
                    onClick={() => update('Impact', n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {errors.Impact && <span className="error">{errors.Impact}</span>}
            </div>
            {preview && (
              <div className="field">
                <label>Severity preview</label>
                <span className={`chip ${preview.band.toLowerCase()}`}>
                  {preview.band} · {preview.score}
                </span>
              </div>
            )}
            {errors._form && <div className="error">{errors._form}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
