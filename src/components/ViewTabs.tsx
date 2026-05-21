export type ViewTab = 'All' | 'Active' | 'Monitoring' | 'Mitigated' | 'Closed';

export const VIEW_TABS: ViewTab[] = ['All', 'Active', 'Monitoring', 'Mitigated', 'Closed'];

interface Props {
  value: ViewTab;
  onChange: (tab: ViewTab) => void;
}

export default function ViewTabs({ value, onChange }: Props) {
  return (
    <div className="tabs">
      {VIEW_TABS.map((t) => (
        <button
          key={t}
          className={value === t ? 'active' : ''}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
