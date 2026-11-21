import { Navigate, Route, Routes } from 'react-router-dom';
import StudioPage from './pages/StudioPage';

export default function App() {
  return (
    <Routes>
      <Route index element={<StudioPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
