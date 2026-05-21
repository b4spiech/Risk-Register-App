import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="home">
      <h2>PMO Risk Register</h2>
      <p className="lede">
        Track project risks across the portfolio. Pick a project to view its
        risk register, severity heatmap, and outstanding mitigations.
      </p>
      <button className="primary cta" onClick={() => navigate('/projects')}>
        Risk Registers
      </button>
    </div>
  );
}
