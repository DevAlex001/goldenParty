import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import BabyShower from './pages/BabyShower'
import GoldenParty from './pages/GoldenParty'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<BabyShower />} />
        <Route path="/baby-shower" element={<Navigate to="/" replace />} />
        <Route path="/golden-party" element={<GoldenParty />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
