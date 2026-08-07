import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RequireAuth, RequireRole } from '@/components/RequireRole'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import LoginRoles from '@/pages/LoginRoles'

const MobileHome = lazy(() => import('@/pages/MobileHome'))
const ContentDetail = lazy(() => import('@/pages/ContentDetail'))
const MobileExams = lazy(() => import('@/pages/MobileExams'))
const MobileExamTake = lazy(() => import('@/pages/MobileExamTake'))
const MobileExamResult = lazy(() => import('@/pages/MobileExamResult'))
const MobileWrongBook = lazy(() => import('@/pages/MobileWrongBook'))
const MobileReport = lazy(() => import('@/pages/MobileReport'))
const SecretaryScores = lazy(() => import('@/pages/SecretaryScores'))
const SecretaryDashboard = lazy(() => import('@/pages/SecretaryDashboard'))
const SecretaryMembers = lazy(() => import('@/pages/SecretaryMembers'))
const ChangePassword = lazy(() => import('@/pages/ChangePassword'))
const AccountCenter = lazy(() => import('@/pages/AccountCenter'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))
const AdminOrg = lazy(() => import('@/pages/AdminOrg'))
const AdminUsers = lazy(() => import('@/pages/AdminUsers'))
const AdminContents = lazy(() => import('@/pages/AdminContents'))
const AdminTasks = lazy(() => import('@/pages/AdminTasks'))
const AdminQuestions = lazy(() => import('@/pages/AdminQuestions'))
const AdminQuestionsType = lazy(() => import('@/pages/AdminQuestionsType'))
const AdminPapers = lazy(() => import('@/pages/AdminPapers'))
const AdminPaperPick = lazy(() => import('@/pages/AdminPaperPick'))
const AdminPaperDetail = lazy(() => import('@/pages/AdminPaperDetail'))
const AdminExams = lazy(() => import('@/pages/AdminExams'))
const AdminAIQuery = lazy(() => import('@/pages/AdminAIQuery'))
const AdminAISettings = lazy(() => import('@/pages/AdminAISettings'))
const AdminAILogs = lazy(() => import('@/pages/AdminAILogs'))
const AIChat = lazy(() => import('@/pages/AIChat'))

function PageFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-sm text-[rgba(18,21,28,0.45)]">
      页面加载中…
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login/roles" element={<LoginRoles />} />

            <Route
              path="/m/home"
              element={
                <RequireAuth>
                  <MobileHome />
                </RequireAuth>
              }
            />
            <Route
              path="/m/content/:id"
              element={
                <RequireAuth>
                  <ContentDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/m/exams"
              element={
                <RequireAuth>
                  <MobileExams />
                </RequireAuth>
              }
            />
            <Route
              path="/m/exam/:examId"
              element={
                <RequireAuth>
                  <MobileExamTake />
                </RequireAuth>
              }
            />
            <Route
              path="/m/exam-result/:attemptId"
              element={
                <RequireAuth>
                  <MobileExamResult />
                </RequireAuth>
              }
            />
            <Route
              path="/m/wrong-book"
              element={
                <RequireAuth>
                  <MobileWrongBook />
                </RequireAuth>
              }
            />
            <Route
              path="/m/report"
              element={
                <RequireAuth>
                  <MobileReport />
                </RequireAuth>
              }
            />
            <Route
              path="/m/chat"
              element={
                <RequireAuth>
                  <AIChat />
                </RequireAuth>
              }
            />
            <Route
              path="/m/chat/:sessionId"
              element={
                <RequireAuth>
                  <AIChat />
                </RequireAuth>
              }
            />
            <Route
              path="/m/scores"
              element={
                <RequireRole roles={['secretary', 'admin']}>
                  <SecretaryScores />
                </RequireRole>
              }
            />
            <Route
              path="/m/dashboard"
              element={
                <RequireRole roles={['secretary', 'admin']}>
                  <SecretaryDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/m/members"
              element={
                <RequireRole roles={['secretary', 'admin']}>
                  <SecretaryMembers />
                </RequireRole>
              }
            />
            <Route
              path="/m/members/:userId"
              element={
                <RequireRole roles={['secretary', 'admin']}>
                  <SecretaryMembers />
                </RequireRole>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountCenter />
                </RequireAuth>
              }
            />
            <Route
              path="/account/password"
              element={
                <RequireAuth>
                  <ChangePassword />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <RequireRole roles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/admin/org"
              element={
                <RequireRole roles={['admin']}>
                  <AdminOrg />
                </RequireRole>
              }
            />
            <Route
              path="/admin/org/:id"
              element={
                <RequireRole roles={['admin']}>
                  <AdminOrg />
                </RequireRole>
              }
            />
            <Route
              path="/admin/org/:id/members"
              element={
                <RequireRole roles={['admin']}>
                  <AdminOrg />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole roles={['admin']}>
                  <AdminUsers />
                </RequireRole>
              }
            />
            <Route
              path="/admin/contents"
              element={
                <RequireRole roles={['admin']}>
                  <AdminContents />
                </RequireRole>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <RequireRole roles={['admin', 'secretary']}>
                  <AdminTasks />
                </RequireRole>
              }
            />
            <Route
              path="/admin/questions"
              element={
                <RequireRole roles={['admin']}>
                  <AdminQuestions />
                </RequireRole>
              }
            />
            <Route
              path="/admin/questions/:type"
              element={
                <RequireRole roles={['admin']}>
                  <AdminQuestionsType />
                </RequireRole>
              }
            />
            <Route
              path="/admin/papers"
              element={
                <RequireRole roles={['admin']}>
                  <AdminPapers />
                </RequireRole>
              }
            />
            <Route
              path="/admin/papers/pick/:type"
              element={
                <RequireRole roles={['admin']}>
                  <AdminPaperPick />
                </RequireRole>
              }
            />
            <Route
              path="/admin/papers/:id"
              element={
                <RequireRole roles={['admin']}>
                  <AdminPaperDetail />
                </RequireRole>
              }
            />
            <Route
              path="/admin/exams"
              element={
                <RequireRole roles={['admin']}>
                  <AdminExams />
                </RequireRole>
              }
            />
            <Route
              path="/admin/ai-query"
              element={
                <RequireRole roles={['admin', 'secretary']}>
                  <AdminAIQuery />
                </RequireRole>
              }
            />
            <Route
              path="/admin/ai-settings"
              element={
                <RequireRole roles={['admin']}>
                  <AdminAISettings />
                </RequireRole>
              }
            />
            <Route
              path="/admin/ai-logs"
              element={
                <RequireRole roles={['admin']}>
                  <AdminAILogs />
                </RequireRole>
              }
            />
            <Route
              path="/admin/chat"
              element={
                <RequireRole roles={['admin']}>
                  <AIChat />
                </RequireRole>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </Router>
  )
}
