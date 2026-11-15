import { createBrowserRouter, Outlet, redirect, useLocation, useNavigate, useRouteError } from 'react-router';
import type { AdminStatus } from '../shared/api/index.js';
import { api } from './lib/api.js';
import { ErrorMessage } from './components/ui/ErrorMessage.js';
import { AdminLogin } from './pages/AdminLogin.js';
import { AdminLayout } from './layouts/AdminLayout.js';
import { MemberHome } from './pages/MemberHome.js';
import { ScreenPage } from './pages/ScreenPage.js';
import { Placeholder } from './pages/Placeholder.js';
import { ExamDetail, examDetailLoader } from './pages/ExamDetail.js';
import { ExamImport } from './pages/ExamImport.js';
import { ExamList, examListLoader } from './pages/ExamList.js';
import { SessionDetail, sessionDetailLoader } from './pages/SessionDetail.js';
import { SessionList, sessionListLoader } from './pages/SessionList.js';

function AdminShell() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.startsWith('/admin/sessions') ? 'sessions' : 'exams';
  return (
    <AdminLayout
      active={active}
      onNavigate={k => nav(`/admin/${k}`)}
      onOpenScreen={() => window.open('/screen', '_blank')}
      onLogout={async () => { await api.post('/api/admin/logout').catch(() => {}); nav('/admin/login', { replace: true }); }}
    >
      <Outlet />
    </AdminLayout>
  );
}

// Guard: every /admin/* page except login needs a mentor session. The server enforces it too (requireMentor).
const adminStatus = () => api.get<AdminStatus>('/api/admin/status');
async function requireLogin() {
  if (!(await adminStatus()).loggedIn) throw redirect('/admin/login');
  return null;
}
async function loginLoader() {
  const s = await adminStatus();
  if (s.loggedIn) throw redirect('/admin/exams');
  return s;
}

function RouteError() {
  const err = useRouteError();
  return <div style={{ padding: 24, maxWidth: 480 }}><ErrorMessage title="Không tải được trang" message={err instanceof Error ? err.message : 'Có lỗi xảy ra'} onRetry={() => location.reload()} /></div>;
}

// Route table follows docs/architecture.md §8. Real screens replace the placeholders in later stories.
export const router = createBrowserRouter([
  { path: '/', element: <MemberHome /> }, // renders its own <MemberLayout> (title and name depend on its state)
  { path: '/screen', element: <ScreenPage /> }, // public projector page; scales its own 1920×1080 stage
  { path: '/admin/login', loader: loginLoader, element: <AdminLogin />, errorElement: <RouteError /> },
  {
    element: <AdminShell />,
    loader: requireLogin,
    errorElement: <RouteError />,
    children: [
      { path: '/admin/exams', loader: examListLoader, element: <ExamList /> },
      { path: '/admin/exams/import', element: <ExamImport /> },
      { path: '/admin/exams/:id', loader: examDetailLoader, element: <ExamDetail /> },
      { path: '/admin/sessions', loader: sessionListLoader, element: <SessionList /> },
      { path: '/admin/sessions/:id', loader: sessionDetailLoader, element: <SessionDetail /> },
      { path: '/admin/sessions/:id/grading', element: <Placeholder title="Chấm tự luận" story="S15" /> },
    ],
  },
]);
