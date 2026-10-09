import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { AppLayout } from '@/components/layout/app-layout'
import { useProfile } from '@/features/profiles/hooks/use-profile'
import { AdminRoute } from '@/components/routes/admin-route'
import { AdminLayout } from '@/components/layout/admin-layout'
import { DisabledAccountPage } from '@/pages/disabled-account-page'
import { LoadingScreen } from '@/components/common/states'

const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password-page').then(module => ({ default: module.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/reset-password-page').then(module => ({ default: module.ResetPasswordPage })))
const AdminPage = lazy(() => import('@/pages/admin-page').then(module => ({ default: module.AdminPage })))
const AdminUsersPage = lazy(() => import('@/pages/admin-users-page').then(module => ({ default: module.AdminUsersPage })))
const AuthPage = lazy(() => import('@/pages/auth-page').then(module => ({ default: module.AuthPage })))
const HomePage = lazy(() => import('@/pages/home-page').then(module => ({ default: module.HomePage })))
const BoardsPage = lazy(() => import('@/pages/boards-page').then(module => ({ default: module.BoardsPage })))
const BoardPage = lazy(() => import('@/pages/board-page').then(module => ({ default: module.BoardPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then(module => ({ default: module.DashboardPage })))
const NotificationsPage = lazy(() => import('@/pages/notifications-page').then(module => ({ default: module.NotificationsPage })))
const SettingsPage = lazy(() => import('@/pages/settings-page').then(module => ({ default: module.SettingsPage })))
const WorkspaceMembersPage = lazy(() => import('@/pages/workspace-members-page').then(module => ({ default: module.WorkspaceMembersPage })))
const InvitePage = lazy(() => import('@/pages/invite-page').then(module => ({ default: module.InvitePage })))

function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const profile = useProfile()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile.isLoading) return <LoadingScreen />
  if (profile.error) return <div className="mx-auto max-w-xl p-8 text-sm text-destructive">Não foi possível validar sua conta. Atualize a página ou fale com o suporte.</div>
  if (profile.data?.disabled_at) return <DisabledAccountPage />
  return <Outlet />
}

export default function App() {
  return <Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<Navigate to="/login" replace />} />
    <Route path="/signup" element={<Navigate to="/login" replace />} />
    <Route path="/create-account" element={<Navigate to="/login" replace />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/invite/:token" element={<InvitePage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="boards" element={<BoardsPage />} />
        <Route path="board/:boardId" element={<BoardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="members" element={<WorkspaceMembersPage />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes></Suspense>
}
