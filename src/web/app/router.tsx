import { useEffect } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Outlet, useLocation, useNavigate, useRouteError } from 'react-router';
import { createAdminAuthLoaders } from '../features/admin-auth/application/admin-auth-loaders.js';
import { useAdminAuthGateway } from '../features/admin-auth/application/admin-auth-context.js';
import { AdminLoginPage } from '../features/admin-auth/ui/AdminLoginPage.js';
import { DiscussionPage } from '../features/discussion/ui/DiscussionPage.js';
import { createExamLoaders } from '../features/exam-import/application/exam-loaders.js';
import { ExamDetailPage } from '../features/exam-import/ui/ExamDetailPage.js';
import { ExamImportPage } from '../features/exam-import/ui/ExamImportPage.js';
import { ExamListPage } from '../features/exam-import/ui/ExamListPage.js';
import { createGradingLoader } from '../features/grading/application/grading-loader.js';
import { GradingPage } from '../features/grading/ui/GradingPage.js';
import { MemberExamPage } from '../features/member-exam/ui/MemberExamPage.js';
import { MemberHomePage } from '../features/member-join/ui/MemberHomePage.js';
import { ReviewPage } from '../features/member-review/ui/ReviewPage.js';
import { useMentorNotices } from '../features/mentor-notices/application/use-mentor-notices.js';
import { titleWithCount } from '../features/mentor-notices/domain/mentor-notices.js';
import { NotificationBell } from '../features/mentor-notices/ui/NotificationBell.js';
import { useDesktopNotify } from '../features/mentor-notices/ui/useDesktopNotify.js';
import { ScreenPage } from '../features/screen/ui/ScreenPage.js';
import { createGroupLoaders } from '../features/groups/application/groups-loaders.js';
import { GroupsPage } from '../features/groups/ui/GroupsPage.js';
import { createSessionAdminLoaders } from '../features/session-admin/application/session-admin-loaders.js';
import { SessionDetailPage } from '../features/session-admin/ui/SessionDetailPage.js';
import { SessionListPage } from '../features/session-admin/ui/SessionListPage.js';
import { SessionReviewPage } from '../features/session-admin/ui/SessionReviewPage.js';
import { ErrorMessage } from '../shared/ui/ErrorMessage.js';
import { SessionStrip } from '../shared/ui/SessionStrip.js';
import { Spinner } from '../shared/ui/Spinner.js';
import { AdminLayout } from './AdminLayout.js';
import { adminAuthGateway, examLibraryGateway, gradingGateway, groupsGateway, sessionAdminGateway } from './composition.js';

const examLoaders = createExamLoaders(examLibraryGateway);
const sessionLoaders = createSessionAdminLoaders(sessionAdminGateway);
const gradingLoader = createGradingLoader(gradingGateway);
const groupLoaders = createGroupLoaders(groupsGateway);
const authLoaders = createAdminAuthLoaders(adminAuthGateway);

function AdminShell() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.startsWith('/admin/sessions') ? 'sessions' : pathname.startsWith('/admin/groups') ? 'groups' : 'exams';
  const auth = useAdminAuthGateway();
  const notices = useMentorNotices(pathname);
  const openSession = (id: number) => nav(`/admin/sessions/${id}`);
  const viewing = Number(/^\/admin\/sessions\/(\d+)/.exec(pathname)?.[1]) || null; // the session whose page is open, highlighted in the bar
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
      strip={<SessionStrip sessions={notices.sessions.map(s => ({ id: s.id, name: s.name, slot: s.slot, status: s.status, attention: s.pending + s.editPending + s.rejoinPending }))} activeId={viewing} onOpen={openSession} onNew={() => nav('/admin/sessions')} />}
      onNavigate={k => nav(`/admin/${k}`)}
      onOpenScreen={() => window.open('/screen', '_blank')}
      onLogout={async () => { await auth.logout().catch(() => {}); nav('/admin/login', { replace: true }); }}
    >
      <Outlet />
    </AdminLayout>
  );
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
  { path: '/', element: <MemberHomePage examScreen={props => <MemberExamPage {...props} />} />, errorElement: <RouteError /> }, // renders its own <MemberLayout> (title and name depend on its state)
  { path: '/review/:attemptId', element: <ReviewPage />, errorElement: <RouteError /> }, // member: own attempt with the answer key, once the session is over
  { path: '/screen', element: <ScreenPage />, errorElement: <RouteError /> }, // the mentor's machine: opens the only open session, or asks which
  { path: '/screen/:sessionId', element: <ScreenPage />, errorElement: <RouteError /> }, // public projector page for ONE session; scales its own 1920×1080 stage
  { path: '/admin/login', loader: authLoaders.login, element: <AdminLoginPage />, errorElement: <RouteError />, hydrateFallbackElement: loading },
  // Projector discussion (S17): mentor-only, full-screen, outside the admin chrome; loads its own data (with its own states).
  { path: '/admin/sessions/:id/discuss', loader: authLoaders.requireLogin, element: <DiscussionPage />, errorElement: <RouteError />, hydrateFallbackElement: loading },
  {
    element: <AdminShell />,
    loader: authLoaders.requireLogin,
    errorElement: <RouteError />,
    hydrateFallbackElement: loading,
    children: [
      { path: '/admin/exams', loader: examLoaders.list, element: <ExamListPage /> },
      { path: '/admin/exams/import', element: <ExamImportPage /> },
      { path: '/admin/exams/:id', loader: examLoaders.detail, element: <ExamDetailPage /> },
      { path: '/admin/groups', loader: groupLoaders.list, element: <GroupsPage /> },
      { path: '/admin/sessions', loader: sessionLoaders.list, element: <SessionListPage /> },
      { path: '/admin/sessions/:id', loader: sessionLoaders.detail, element: <SessionDetailPage /> },
      { path: '/admin/sessions/:id/review', loader: sessionLoaders.review, element: <SessionReviewPage /> },
      { path: '/admin/sessions/:id/grading', loader: gradingLoader, element: <GradingPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
