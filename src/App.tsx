import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import StudioPage from './pages/StudioPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StudioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
