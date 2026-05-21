import { Link, Route, Routes } from 'react-router-dom';
import Home from './screens/Home';
import ProjectList from './screens/ProjectList';
import ProjectDetail from './screens/ProjectDetail';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          <Link to="/" style={{ color: 'inherit' }}>PMO Risk Register</Link>
        </h1>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
      </Routes>
    </div>
  );
}
