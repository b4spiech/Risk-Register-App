import { useEffect, useMemo, useState } from 'react';
import { getScore, getSeverity } from '../lib/severity';
import type {
  AcceptanceType,
  PMOAction,
  Project,
  ResponseStatus,
  Risk,
  RiskCreatePayload,
  RiskStatus,
  TransferMechanism,
} from '../lib/types';

interface Props {
  open: boolean;
  projects: Project[];
  defaultProjectId?: number;
  editing?: Risk | null;
  onClose: () => void;
  onSubmit: (payload: RiskCreatePayload, editingId?: number) => Promise<void>;
}

const ACTIONS: PMOAction[] = ['Avoid', 'Mitigate', 'Transfer', 'Escalate', 'Accept', 'Ignore'];
const RISK_STATUSES: RiskStatus[] = ['Active', 'Monitoring', 'Closed'];
const RESPONSE_STATUSES: ResponseStatus[] = ['Not Started', 'In Progress', 'Complete'];
const TRANSFER_MECHANISMS: TransferMechanism[] = ['Insurance', 'Bond', 'Contract', 'Warranty', 'Other'];
const ACCEPTANCE_TYPES: AcceptanceType[] = ['Passive', 'Active'];
const SCALE = [1, 2, 3, 4, 5];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  Title: string;
  RiskDescription: string;
  ProjectID: number | null;
  Probability: number | null;
  Impact: number | null;
  PMOAction: PMOAction | null;
  RiskStatus: RiskStatus;
  ResponseOwner: string;
  ResponsePlan: string;
  ResponseTargetDate: string;
  ResponseStatus: ResponseStatus;
  TransferredTo: string;
  TransferMechanism: TransferMechanism | null;
  EscalatedTo: string;
  AcceptanceType: AcceptanceType | null;
  TriggerCondition: string;
  ContingencyPlan: string;
  ContingencyReserve: string;
}

const EMPTY: FormState = {
  Title: '',
  RiskDescription: '',
  ProjectID: null,
  Probability: null,
  Impact: null,
  PMOAction: null,
  RiskStatus: 'Active',
  ResponseOwner: '',
  ResponsePlan: '',
  ResponseTargetDate: '',
  ResponseStatus: 'Not Started',
  TransferredTo: '',
  TransferMechanism: null,
  EscalatedTo: '',
  AcceptanceType: null,
  TriggerCondition: '',
  ContingencyPlan: '',
  ContingencyReserve: '',
};

const SHARED_TACTICS: PMOAction[] = ['Avoid', 'Mitigate', 'Transfer', 'Escalate'];

function usesSharedFields(action: PMOAction | null, accType: AcceptanceType | null): boolean {
  if (!action) return false;
  if (SHARED_TACTICS.includes(action)) return true;
  if (action === 'Accept' && accType === 'Active') return true;
  return false;
}

function fromRisk(r: Risk): FormState {
  return {
    Title: r.Title,
    RiskDescription: r.RiskDescription,
    ProjectID: r.ProjectID,
    Probability: r.Probability,
    Impact: r.Impact,
    PMOAction: r.PMOAction,
    RiskStatus: r.RiskStatus,
    ResponseOwner: r.ResponseOwner ?? '',
    ResponsePlan: r.ResponsePlan ?? '',
    ResponseTargetDate: r.ResponseTargetDate ?? '',
    ResponseStatus: r.ResponseStatus ?? 'Not Started',
    TransferredTo: r.TransferredTo ?? '',
    TransferMechanism: r.TransferMechanism,
    EscalatedTo: r.EscalatedTo ?? '',
    AcceptanceType: r.AcceptanceType,
    TriggerCondition: r.TriggerCondition ?? '',
    ContingencyPlan: r.ContingencyPlan ?? '',
    ContingencyReserve: r.ContingencyReserve ?? '',
  };
}

function applyActionChange(s: FormState, action: PMOAction | null): FormState {
  const next = { ...s, PMOAction: action };
  if (action !== 'Accept') {
    next.AcceptanceType = null;
    next.TriggerCondition = '';
    next.ContingencyPlan = '';
    next.ContingencyReserve = '';
  }
  if (action !== 'Transfer') {
    next.TransferredTo = '';
    next.TransferMechanism = null;
  }
  if (action !== 'Escalate') {
    next.EscalatedTo = '';
  }
  // Ignore (and no-action) drops shared fields. Accept holds them until
  // AcceptanceType is chosen — applyAcceptanceChange clears on Passive.
  if (action === 'Ignore' || action === null) {
    next.ResponseOwner = '';
    next.ResponsePlan = '';
    next.ResponseTargetDate = '';
    next.ResponseStatus = 'Not Started';
  }
  return next;
}

function applyAcceptanceChange(s: FormState, accType: AcceptanceType | null): FormState {
  const next = { ...s, AcceptanceType: accType };
  if (accType === 'Passive') {
    next.ResponseOwner = '';
    next.ResponsePlan = '';
    next.ResponseTargetDate = '';
    next.ResponseStatus = 'Not Started';
    next.TriggerCondition = '';
    next.ContingencyPlan = '';
    next.ContingencyReserve = '';
  }
  return next;
}

function validate(s: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.Title.trim()) e.Title = 'Required';
  if (!s.RiskDescription.trim()) e.RiskDescription = 'Required';
  if (s.ProjectID == null) e.ProjectID = 'Pick a project';
  if (s.Probability == null) e.Probability = 'Pick a value 1–5';
  if (s.Impact == null) e.Impact = 'Pick a value 1–5';
  if (!s.PMOAction) e.PMOAction = 'Pick an action';

  const action = s.PMOAction;
  const shared = usesSharedFields(action, s.AcceptanceType);
  if (shared) {
    if (!s.ResponseOwner.trim()) e.ResponseOwner = 'Required';
    else if (!EMAIL_RE.test(s.ResponseOwner.trim())) e.ResponseOwner = 'Must be a valid email';
    if (!s.ResponseStatus) e.ResponseStatus = 'Required';
  }
  if (action === 'Avoid' || action === 'Mitigate') {
    if (!s.ResponsePlan.trim()) e.ResponsePlan = 'Required';
    if (!s.ResponseTargetDate.trim()) e.ResponseTargetDate = 'Required';
  }
  if (action === 'Transfer') {
    if (!s.TransferredTo.trim()) e.TransferredTo = 'Required';
    if (!s.TransferMechanism) e.TransferMechanism = 'Required';
  }
  if (action === 'Escalate') {
    if (!s.EscalatedTo.trim()) e.EscalatedTo = 'Required';
  }
  if (action === 'Accept') {
    if (!s.AcceptanceType) e.AcceptanceType = 'Pick Passive or Active';
    if (s.AcceptanceType === 'Active') {
      if (!s.TriggerCondition.trim()) e.TriggerCondition = 'Required';
      if (!s.ContingencyPlan.trim()) e.ContingencyPlan = 'Required';
    }
  }
  return e;
}

function buildPayload(s: FormState): RiskCreatePayload {
  const action = s.PMOAction!;
  const shared = usesSharedFields(action, s.AcceptanceType);
  const payload: RiskCreatePayload = {
    Title: s.Title.trim(),
    RiskDescription: s.RiskDescription.trim(),
    ProjectID: s.ProjectID!,
    Probability: s.Probability!,
    Impact: s.Impact!,
    PMOAction: action,
    RiskStatus: s.RiskStatus,
  };
  if (shared) {
    payload.ResponseOwner = s.ResponseOwner.trim();
    payload.ResponseStatus = s.ResponseStatus;
    if (s.ResponsePlan.trim()) payload.ResponsePlan = s.ResponsePlan.trim();
    if (s.ResponseTargetDate.trim()) payload.ResponseTargetDate = s.ResponseTargetDate;
  }
  if (action === 'Transfer') {
    payload.TransferredTo = s.TransferredTo.trim();
    payload.TransferMechanism = s.TransferMechanism;
  }
  if (action === 'Escalate') {
    payload.EscalatedTo = s.EscalatedTo.trim();
  }
  if (action === 'Accept') {
    payload.AcceptanceType = s.AcceptanceType;
    if (s.AcceptanceType === 'Active') {
      payload.TriggerCondition = s.TriggerCondition.trim();
      payload.ContingencyPlan = s.ContingencyPlan.trim();
      if (s.ContingencyReserve.trim()) payload.ContingencyReserve = s.ContingencyReserve.trim();
    }
  }
  return payload;
}

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
    setState(editing ? fromRisk(editing) : { ...EMPTY, ProjectID: defaultProjectId ?? null });
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setAction(action: PMOAction) {
    setState((s) => applyActionChange(s, action));
  }

  function setAcceptanceType(accType: AcceptanceType) {
    setState((s) => applyAcceptanceChange(s, accType));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate(state);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(buildPayload(state), editing?.ID);
      onClose();
    } catch (err) {
      setErrors({ _form: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  const action = state.PMOAction;
  const shared = usesSharedFields(action, state.AcceptanceType);
  const showSharedSection = shared || (action === 'Accept' && state.AcceptanceType === null);
  const planRequired = action === 'Avoid' || action === 'Mitigate';
  const dateRequired = action === 'Avoid' || action === 'Mitigate';

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
            <div className="field">
              <label>PMO action</label>
              <div className="row">
                {ACTIONS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    className={state.PMOAction === a ? 'selected' : ''}
                    onClick={() => setAction(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {errors.PMOAction && <span className="error">{errors.PMOAction}</span>}
            </div>

            {action === 'Accept' && (
              <div className="field">
                <label>Acceptance type</label>
                <div className="row">
                  {ACCEPTANCE_TYPES.map((a) => (
                    <button
                      type="button"
                      key={a}
                      className={state.AcceptanceType === a ? 'selected' : ''}
                      onClick={() => setAcceptanceType(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                {errors.AcceptanceType && <span className="error">{errors.AcceptanceType}</span>}
              </div>
            )}

            {showSharedSection && (
              <div className="response-section">
                <div className="response-section-title">Response</div>
                <div className="field">
                  <label>Response owner (email)</label>
                  <input
                    type="email"
                    placeholder="name@kendallgroup.com"
                    value={state.ResponseOwner}
                    onChange={(e) => update('ResponseOwner', e.target.value)}
                  />
                  {errors.ResponseOwner && <span className="error">{errors.ResponseOwner}</span>}
                </div>
                <div className="field">
                  <label>
                    Response plan{' '}
                    {!planRequired && <span className="muted-label">(optional)</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={state.ResponsePlan}
                    onChange={(e) => update('ResponsePlan', e.target.value)}
                    placeholder={
                      action === 'Avoid'
                        ? 'How the project plan changes to eliminate the risk.'
                        : action === 'Mitigate'
                          ? 'Specific, measurable action (e.g. "weekly vendor review; escalate if 2 milestones missed").'
                          : action === 'Transfer'
                            ? 'Terms of the transfer arrangement, if any.'
                            : action === 'Escalate'
                              ? 'Why this is being escalated; the question being asked.'
                              : action === 'Accept'
                                ? 'What you are monitoring while the contingency is shelved.'
                                : ''
                    }
                  />
                  {errors.ResponsePlan && <span className="error">{errors.ResponsePlan}</span>}
                </div>
                <div className="field">
                  <label>
                    Target date{' '}
                    {!dateRequired && <span className="muted-label">(optional)</span>}
                  </label>
                  <input
                    type="date"
                    value={state.ResponseTargetDate}
                    onChange={(e) => update('ResponseTargetDate', e.target.value)}
                  />
                  {errors.ResponseTargetDate && (
                    <span className="error">{errors.ResponseTargetDate}</span>
                  )}
                </div>
                <div className="field">
                  <label>Response status</label>
                  <select
                    value={state.ResponseStatus}
                    onChange={(e) => update('ResponseStatus', e.target.value as ResponseStatus)}
                  >
                    {RESPONSE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.ResponseStatus && <span className="error">{errors.ResponseStatus}</span>}
                </div>
              </div>
            )}

            {action === 'Transfer' && (
              <div className="response-section">
                <div className="response-section-title">Transfer details</div>
                <div className="field">
                  <label>Transferred to</label>
                  <input
                    value={state.TransferredTo}
                    onChange={(e) => update('TransferredTo', e.target.value)}
                    placeholder="Who now holds the risk (vendor, insurer, partner)"
                  />
                  {errors.TransferredTo && <span className="error">{errors.TransferredTo}</span>}
                </div>
                <div className="field">
                  <label>Mechanism</label>
                  <div className="row">
                    {TRANSFER_MECHANISMS.map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={state.TransferMechanism === m ? 'selected' : ''}
                        onClick={() => update('TransferMechanism', m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {errors.TransferMechanism && (
                    <span className="error">{errors.TransferMechanism}</span>
                  )}
                </div>
              </div>
            )}

            {action === 'Escalate' && (
              <div className="response-section">
                <div className="response-section-title">Escalation details</div>
                <div className="field">
                  <label>Escalated to</label>
                  <input
                    value={state.EscalatedTo}
                    onChange={(e) => update('EscalatedTo', e.target.value)}
                    placeholder="Program / portfolio / leadership now owning the decision"
                  />
                  {errors.EscalatedTo && <span className="error">{errors.EscalatedTo}</span>}
                </div>
              </div>
            )}

            {action === 'Accept' && state.AcceptanceType === 'Active' && (
              <div className="response-section">
                <div className="response-section-title">Contingency (Active Accept)</div>
                <div className="field">
                  <label>Trigger condition</label>
                  <input
                    value={state.TriggerCondition}
                    onChange={(e) => update('TriggerCondition', e.target.value)}
                    placeholder='e.g. "Help-desk tickets > 10/day for 3 consecutive days"'
                  />
                  {errors.TriggerCondition && (
                    <span className="error">{errors.TriggerCondition}</span>
                  )}
                </div>
                <div className="field">
                  <label>Contingency plan</label>
                  <textarea
                    rows={3}
                    value={state.ContingencyPlan}
                    onChange={(e) => update('ContingencyPlan', e.target.value)}
                    placeholder="What to do when the trigger fires."
                  />
                  {errors.ContingencyPlan && (
                    <span className="error">{errors.ContingencyPlan}</span>
                  )}
                </div>
                <div className="field">
                  <label>
                    Contingency reserve <span className="muted-label">(optional)</span>
                  </label>
                  <input
                    value={state.ContingencyReserve}
                    onChange={(e) => update('ContingencyReserve', e.target.value)}
                    placeholder="Time / budget / resources set aside."
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>Risk status</label>
              <select
                value={state.RiskStatus}
                onChange={(e) => update('RiskStatus', e.target.value as RiskStatus)}
              >
                {RISK_STATUSES.map((s) => (
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
