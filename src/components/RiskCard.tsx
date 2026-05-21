import { useState } from 'react';
import { getScore, getSeverity } from '../lib/severity';
import type { Risk } from '../lib/types';

interface Props {
  risk: Risk;
  onEdit: () => void;
}

export default function RiskCard({ risk, onEdit }: Props) {
  const band = getSeverity(risk.Probability, risk.Impact);
  const score = getScore(risk.Probability, risk.Impact);
  const [expanded, setExpanded] = useState(false);
  const isLong = risk.RiskDescription.length > 140;
  const desc = !isLong || expanded
    ? risk.RiskDescription
    : risk.RiskDescription.slice(0, 140) + '…';

  return (
    <div className="card risk-card">
      <h4>{risk.Title}</h4>
      <span className={`chip ${band.toLowerCase()}`} title={`Score ${score}`}>
        {band === 'Red' ? '🔴' : band === 'Yellow' ? '🟡' : '🟢'} {score}
      </span>
      <div className="meta">
        <span className="badge gray">P{risk.Probability} × I{risk.Impact}</span>
        <span className="badge">{risk.PMOAction}</span>
        <span className="badge gray">{risk.RiskStatus}</span>
        {risk.PMOAction === 'Mitigate' && risk.RiskOwner && (
          <span className="badge owner">👤 {risk.RiskOwner}</span>
        )}
      </div>
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
      <div className="actions">
        <button onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}
