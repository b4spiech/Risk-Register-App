import { useMemo } from 'react';
import { getSeverity } from '../lib/severity';
import type { Risk } from '../lib/types';

interface Selection {
  probability: number;
  impact: number;
}

interface Props {
  risks: Risk[];
  selected: Selection | null;
  onSelect: (sel: Selection | null) => void;
}

const ROWS = [5, 4, 3, 2, 1]; // probability, top-to-bottom
const COLS = [1, 2, 3, 4, 5]; // impact, left-to-right

export default function RiskHeatmap({ risks, selected, onSelect }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of risks) {
      const key = `${r.Probability}-${r.Impact}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [risks]);

  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th></th>
            {COLS.map((i) => (
              <th key={i}>I{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((p) => (
            <tr key={p}>
              <th>P{p}</th>
              {COLS.map((i) => {
                const band = getSeverity(p, i).toLowerCase();
                const count = counts.get(`${p}-${i}`) ?? 0;
                const isSelected =
                  selected != null && selected.probability === p && selected.impact === i;
                const classes = [
                  'cell',
                  band,
                  count === 0 ? 'empty' : '',
                  isSelected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const onClick = () => {
                  if (isSelected) onSelect(null);
                  else onSelect({ probability: p, impact: i });
                };
                return (
                  <td
                    key={i}
                    className={classes}
                    onClick={onClick}
                    title={`P${p} × I${i} = ${p * i} — ${count} risk${count === 1 ? '' : 's'}`}
                  >
                    {p * i}
                    {count > 0 && <span className="count">{count}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-axis">Impact →</div>
    </div>
  );
}
