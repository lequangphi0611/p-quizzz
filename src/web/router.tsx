import { createBrowserRouter, Outlet, useLocation, useNavigate } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout.js';
import { MemberLayout } from './layouts/MemberLayout.js';
import { ScreenLayout } from './layouts/ScreenLayout.js';
import { Placeholder } from './pages/Placeholder.js';

function MemberShell() {
  return <MemberLayout><Outlet /></MemberLayout>;
}

function AdminShell() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.startsWith('/admin/sessions') ? 'sessions' : 'exams';
  return (
    <AdminLayout active={active} onNavigate={k => nav(`/admin/${k}`)} onOpenScreen={() => window.open('/screen', '_blank')}>
      <Outlet />
    </AdminLayout>
  );
}

function ScreenShell() {
  return <ScreenLayout><Outlet /></ScreenLayout>;
}

// Route table follows docs/architecture.md §8. Real screens replace the placeholders in later stories.
export const router = createBrowserRouter([
  { element: <MemberShell />, children: [{ path: '/', element: <Placeholder title="Vào phiên thi" story="S10" /> }] },
  { element: <ScreenShell />, children: [{ path: '/screen', element: <Placeholder title="Màn hình chiếu" story="S14" /> }] },
  { path: '/admin/login', element: <Placeholder title="Đăng nhập mentor" story="S03" /> },
  {
    element: <AdminShell />,
    children: [
      { path: '/admin/exams', element: <Placeholder title="Đề thi" story="S05" /> },
      { path: '/admin/exams/import', element: <Placeholder title="Import đề" story="S05" /> },
      { path: '/admin/exams/:id', element: <Placeholder title="Chi tiết đề" story="S05" /> },
      { path: '/admin/sessions', element: <Placeholder title="Phiên thi" story="S09" /> },
      { path: '/admin/sessions/:id', element: <Placeholder title="Điều khiển phiên" story="S09" /> },
      { path: '/admin/sessions/:id/grading', element: <Placeholder title="Chấm tự luận" story="S15" /> },
    ],
  },
]);
