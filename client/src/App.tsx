import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import TacticalBoard from './pages/TacticalBoard';
import FearlessDraft from './pages/FearlessDraft';
import VodRoom from './pages/VodRoom';
import ScrimsScouting from './pages/ScrimsScouting';
import RosterPool from './pages/RosterPool';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TacticalBoard />} />
          <Route path="draft" element={<FearlessDraft />} />
          <Route path="vods" element={<VodRoom />} />
          <Route path="scrims" element={<ScrimsScouting />} />
          <Route path="roster" element={<RosterPool />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}