import { useState } from 'react';
import { getScore, getSeverity } from '../lib/severity';
import type { Risk } from '../lib/types';

interface Props {
  risk: Risk;
}

function actionLabel(risk: Risk): string {
  if (risk.PMOAction === 'Accept' && risk.AcceptanceType) {
    return `${risk.AcceptanceType} Accept`;
  }
  return risk.PMOAction;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function RiskCard({ risk }: Props) {
  const band = getSeverity(risk.Probability, risk.Impact);
  const score = getScore(risk.Probability, risk.Impact);
  const [expanded, setExpanded] = useState(false);
  const isLong = risk.RiskDescription.length > 140;
  const desc = !isLong || expanded
    ? risk.RiskDescription
    : risk.RiskDescription.slice(0, 140) + '…';

  const isPassiveAccept = risk.PMOAction === 'Accept' && risk.AcceptanceType === 'Passive';
  const isActiveAccept = risk.PMOAction === 'Accept' && risk.AcceptanceType === 'Active';
  const showResponseDetail =
    risk.PMOAction === 'Avoid' ||
    risk.PMOAction === 'Mitigate' ||
    risk.PMOAction === 'Transfer' ||
    risk.PMOAction === 'Escalate' ||
    isActiveAccept;

  return (
    <div className="card risk-card">
      <h4>{risk.Title}</h4>
      <span className={`chip ${band.toLowerCase()}`} title={`Score ${score}`}>
        {band === 'Red' ? '🔴' : band === 'Yellow' ? '🟡' : '🟢'} {score}
      </span>
      <div className="meta">
        <span className="badge gray">P{risk.Probability} × I{risk.Impact}</span>
        <span className="badge">{actionLabel(risk)}</span>
        <span className="badge gray">{risk.RiskStatus}</span>
        {showResponseDetail && risk.ResponseStatus && (
          <span className="badge">{risk.ResponseStatus}</span>
        )}
        {showResponseDetail && risk.ResponseOwner && (
          <span className="badge owner">👤 {risk.ResponseOwner}</span>
        )}
      </div>

      {risk.PMOAction === 'Transfer' && risk.TransferredTo && (
        <div className="tactic-line">
          Transferred to <strong>{risk.TransferredTo}</strong>
          {risk.TransferMechanism && <> via <strong>{risk.TransferMechanism}</strong></>}
        </div>
      )}

      {risk.PMOAction === 'Escalate' && risk.EscalatedTo && (
        <div className="tactic-line">
          Escalated to <strong>{risk.EscalatedTo}</strong>
        </div>
      )}

      {isActiveAccept && risk.TriggerCondition && (
        <div className="tactic-line">
          Contingency — triggers on: <strong>{risk.TriggerCondition}</strong>
        </div>
      )}

      {isPassiveAccept && (
        <div className="tactic-line muted">Documented and accepted. No response.</div>
      )}

      {(risk.PMOAction === 'Avoid' || risk.PMOAction === 'Mitigate' || isActiveAccept) &&
        risk.ResponsePlan && (
          <div className="tactic-line muted">
            <em>Plan:</em> {truncate(risk.ResponsePlan, 160)}
          </div>
        )}

      {(risk.PMOAction === 'Avoid' || risk.PMOAction === 'Mitigate') && risk.ResponseTargetDate && (
        <div className="tactic-line muted">
          <em>Target:</em> {risk.ResponseTargetDate}
        </div>
      )}

      <div className="desc">
        {desc}
        {isLong && (
          <>
            {' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? 'less' : 'more'}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
