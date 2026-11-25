import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import LoginPage from '../features/auth/LoginPage';
import RoomStudioPage from '../features/studio/RoomStudioPage';
import StudioPage from '../features/studio/StudioPage';
import TeamPage from '../features/team/TeamPage';
import ClientPage from '../features/workspace/ClientPage';
import ClientsPage from '../features/workspace/ClientsPage';
import ProjectPage from '../features/workspace/ProjectPage';
import ProjectsPage from '../features/workspace/ProjectsPage';
import RoomPage from '../features/workspace/RoomPage';
import { AppBar } from '../components/layout/AppBar';
import { RequireAuth } from './auth';

/** A management page: the app bar and a page that scrolls inside the one-screen layout. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <AppBar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Shell><ProjectsPage /></Shell></RequireAuth>} />
      <Route path="/clients" element={<RequireAuth><Shell><ClientsPage /></Shell></RequireAuth>} />
      <Route path="/clients/:id" element={<RequireAuth><Shell><ClientPage /></Shell></RequireAuth>} />
      <Route path="/projects/:id" element={<RequireAuth><Shell><ProjectPage /></Shell></RequireAuth>} />
      <Route path="/rooms/:id" element={<RequireAuth><Shell><RoomPage /></Shell></RequireAuth>} />
      <Route path="/rooms/:id/studio" element={<RequireAuth roles={['admin', 'designer']}><RoomStudioPage /></RequireAuth>} />
      <Route path="/studio" element={<RequireAuth roles={['admin', 'designer']}><StudioPage /></RequireAuth>} />
      <Route path="/team" element={<RequireAuth roles={['admin']}><Shell><TeamPage /></Shell></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
