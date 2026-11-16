import { useEffect } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Outlet, redirect, useLocation, useNavigate, useRouteError } from 'react-router';
import type { AdminStatus } from '../shared/api/index.js';
import { api } from './lib/api.js';
import { NotificationBell } from './components/NotificationBell.js';
import { ErrorMessage } from './components/ui/ErrorMessage.js';
import { titleWithCount } from './lib/mentor-notices.js';
import { useDesktopNotify } from './lib/useDesktopNotify.js';
import { useMentorNotices } from './lib/useMentorNotices.js';
import { Spinner } from './components/ui/Spinner.js';
import { AdminLogin } from './pages/AdminLogin.js';
import { AdminLayout } from './layouts/AdminLayout.js';
import { DiscussionPage } from './features/discussion/ui/DiscussionPage.js';
import { createGradingLoader } from './features/grading/application/grading-loader.js';
import { GradingPage } from './features/grading/ui/GradingPage.js';
import { createSessionAdminLoaders } from './features/session-admin/application/session-admin-loaders.js';
import { SessionDetailPage } from './features/session-admin/ui/SessionDetailPage.js';
import { SessionListPage } from './features/session-admin/ui/SessionListPage.js';
import { SessionReviewPage } from './features/session-admin/ui/SessionReviewPage.js';
import { gradingGateway, sessionAdminGateway } from './app/composition.js';
import { MemberHome } from './pages/MemberHome.js';
import { ReviewPage } from './pages/ReviewPage.js';
import { ScreenPage } from './pages/ScreenPage.js';
import { ExamDetail, examDetailLoader } from './pages/ExamDetail.js';
import { ExamImport } from './pages/ExamImport.js';
import { ExamList, examListLoader } from './pages/ExamList.js';

const sessionLoaders = createSessionAdminLoaders(sessionAdminGateway);
const gradingLoader = createGradingLoader(gradingGateway);

function AdminShell() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.startsWith('/admin/sessions') ? 'sessions' : 'exams';
  const notices = useMentorNotices(pathname);
  const openSession = (id: number) => nav(`/admin/sessions/${id}`);
  const desktop = useDesktopNotify(notices, openSession);
  // Unread count in the tab title, so new joins/submissions show while the mentor is in another tab.
  useEffect(() => {
    document.title = titleWithCount('p-quizzz', notices.unread);
    return () => { document.title = 'p-quizzz'; };
  }, [notices.unread]);
  return (
    <AdminLayout
      active={active}
      notifications={<NotificationBell state={notices} desktop={desktop} onOpenSession={openSession} />}
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

// Shown while a route's loader runs on a hard page load (instead of a blank page).
const loading = <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner block label="Đang tải…" /></div>;

function RouteError() {
  const err = useRouteError();
  if (isRouteErrorResponse(err) && err.status === 404) return <NotFound />;
  return <div style={{ padding: 24, maxWidth: 480 }}><ErrorMessage title="Không tải được trang" message={err instanceof Error ? err.message : 'Có lỗi xảy ra'} onRetry={() => location.reload()} /></div>;
}

// Unknown address (typo, old link): say so in plain Vietnamese instead of React Router's developer screen.
function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, display: 'grid', gap: 12, textAlign: 'center' }}>
        <h1 style={{ font: 'var(--type-h1)', margin: 0 }}>Không tìm thấy trang</h1>
        <p style={{ font: 'var(--type-ui)', color: 'var(--text-meta)', margin: 0 }}>Đường dẫn này không tồn tại hoặc đã cũ. Quay lại trang chính để vào phòng thi.</p>
        <a href="/" style={{ font: 'var(--type-ui)', fontWeight: 600, color: 'var(--brand-600)' }}>Về trang chính</a>
      </div>
    </div>
  );
}

// Route table follows docs/architecture.md §8. Real screens replace the placeholders in later stories.
export const router = createBrowserRouter([
  { path: '/', element: <MemberHome />, errorElement: <RouteError /> }, // renders its own <MemberLayout> (title and name depend on its state)
  { path: '/review/:attemptId', element: <ReviewPage />, errorElement: <RouteError /> }, // member: own attempt with the answer key, once the session is over
  { path: '/screen', element: <ScreenPage />, errorElement: <RouteError /> }, // public projector page; scales its own 1920×1080 stage
  { path: '/admin/login', loader: loginLoader, element: <AdminLogin />, errorElement: <RouteError />, hydrateFallbackElement: loading },
  // Projector discussion (S17): mentor-only, full-screen, outside the admin chrome; loads its own data (with its own states).
  { path: '/admin/sessions/:id/discuss', loader: requireLogin, element: <DiscussionPage />, errorElement: <RouteError />, hydrateFallbackElement: loading },
  {
    element: <AdminShell />,
    loader: requireLogin,
    errorElement: <RouteError />,
    hydrateFallbackElement: loading,
    children: [
      { path: '/admin/exams', loader: examListLoader, element: <ExamList /> },
      { path: '/admin/exams/import', element: <ExamImport /> },
      { path: '/admin/exams/:id', loader: examDetailLoader, element: <ExamDetail /> },
      { path: '/admin/sessions', loader: sessionLoaders.list, element: <SessionListPage /> },
      { path: '/admin/sessions/:id', loader: sessionLoaders.detail, element: <SessionDetailPage /> },
      { path: '/admin/sessions/:id/review', loader: sessionLoaders.review, element: <SessionReviewPage /> },
      { path: '/admin/sessions/:id/grading', loader: gradingLoader, element: <GradingPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
