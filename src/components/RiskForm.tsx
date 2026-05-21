import { useEffect, useMemo, useState } from 'react';
import { getScore, getSeverity } from '../lib/severity';
import type {
  PMOAction,
  Project,
  Risk,
  RiskCreatePayload,
  RiskStatus,
} from '../lib/types';

interface Props {
  open: boolean;
  projects: Project[];
  defaultProjectId?: number;
  editing?: Risk | null;
  onClose: () => void;
  onSubmit: (payload: RiskCreatePayload, editingId?: number) => Promise<void>;
}

const ACTIONS: PMOAction[] = ['Accept', 'Mitigate', 'Ignore'];
const STATUSES: RiskStatus[] = ['Active', 'Monitoring', 'Closed'];
const SCALE = [1, 2, 3, 4, 5];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  Title: string;
  RiskDescription: string;
  ProjectID: number | null;
  Probability: number | null;
  Impact: number | null;
  PMOAction: PMOAction | null;
  RiskOwner: string;
  RiskStatus: RiskStatus;
}

const EMPTY: FormState = {
  Title: '',
  RiskDescription: '',
  ProjectID: null,
  Probability: null,
  Impact: null,
  PMOAction: null,
  RiskOwner: '',
  RiskStatus: 'Active',
};

export default function RiskForm({
  open,
  projects,
  defaultProjectId,
  editing,
  onClose,
  onSubmit,
}: Props) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setState({
        Title: editing.Title,
        RiskDescription: editing.RiskDescription,
        ProjectID: editing.ProjectID,
        Probability: editing.Probability,
        Impact: editing.Impact,
        PMOAction: editing.PMOAction,
        RiskOwner: editing.RiskOwner ?? '',
        RiskStatus: editing.RiskStatus,
      });
    } else {
      setState({ ...EMPTY, ProjectID: defaultProjectId ?? null });
    }
    setErrors({});
  }, [open, editing, defaultProjectId]);

  const preview = useMemo(() => {
    if (state.Probability == null || state.Impact == null) return null;
    return {
      score: getScore(state.Probability, state.Impact),
      band: getSeverity(state.Probability, state.Impact),
    };
  }, [state.Probability, state.Impact]);

  if (!open) return null;

  const ownerRequired = state.PMOAction === 'Mitigate';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => {
      const next = { ...s, [key]: value };
      if (key === 'PMOAction' && value !== 'Mitigate') {
        next.RiskOwner = '';
      }
      return next;
    });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!state.Title.trim()) e.Title = 'Required';
    if (!state.RiskDescription.trim()) e.RiskDescription = 'Required';
    if (state.ProjectID == null) e.ProjectID = 'Pick a project';
    if (state.Probability == null) e.Probability = 'Pick a value 1–5';
    if (state.Impact == null) e.Impact = 'Pick a value 1–5';
    if (!state.PMOAction) e.PMOAction = 'Pick an action';
    if (ownerRequired) {
      if (!state.RiskOwner.trim()) e.RiskOwner = 'Required when action is Mitigate';
      else if (!EMAIL_RE.test(state.RiskOwner.trim())) e.RiskOwner = 'Must be a valid email';
    }
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const payload: RiskCreatePayload = {
      Title: state.Title.trim(),
      RiskDescription: state.RiskDescription.trim(),
      ProjectID: state.ProjectID!,
      Probability: state.Probability!,
      Impact: state.Impact!,
      PMOAction: state.PMOAction!,
      RiskStatus: state.RiskStatus,
      RiskOwner: ownerRequired ? state.RiskOwner.trim() : null,
    };
    setSubmitting(true);
    try {
      await onSubmit(payload, editing?.ID);
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
          <h3>{editing ? 'Edit risk' : 'New risk'}</h3>
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
              {errors.RiskDescription && (
                <span className="error">{errors.RiskDescription}</span>
              )}
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
            <div className="field">
              <label>PMO action</label>
              <div className="row">
                {ACTIONS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    className={state.PMOAction === a ? 'selected' : ''}
                    onClick={() => update('PMOAction', a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {errors.PMOAction && <span className="error">{errors.PMOAction}</span>}
            </div>
            {ownerRequired && (
              <div className="field">
                <label>Owner (email)</label>
                <input
                  type="email"
                  placeholder="name@kendallgroup.com"
                  value={state.RiskOwner}
                  onChange={(e) => update('RiskOwner', e.target.value)}
                />
                {errors.RiskOwner && <span className="error">{errors.RiskOwner}</span>}
              </div>
            )}
            <div className="field">
              <label>Status</label>
              <select
                value={state.RiskStatus}
                onChange={(e) => update('RiskStatus', e.target.value as RiskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {errors._form && <div className="error">{errors._form}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
