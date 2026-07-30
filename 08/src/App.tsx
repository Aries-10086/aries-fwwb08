import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import LoginRoles from '@/pages/LoginRoles'
import MobileHome from '@/pages/MobileHome'
import ContentDetail from '@/pages/ContentDetail'
import MobileExams from '@/pages/MobileExams'
import MobileExamTake from '@/pages/MobileExamTake'
import MobileExamResult from '@/pages/MobileExamResult'
import MobileWrongBook from '@/pages/MobileWrongBook'
import MobileReport from '@/pages/MobileReport'
import SecretaryScores from '@/pages/SecretaryScores'
import SecretaryDashboard from '@/pages/SecretaryDashboard'
import SecretaryMembers from '@/pages/SecretaryMembers'
import ChangePassword from '@/pages/ChangePassword'
import AccountCenter from '@/pages/AccountCenter'
import AdminDashboard from '@/pages/AdminDashboard'
import AdminOrg from '@/pages/AdminOrg'
import AdminUsers from '@/pages/AdminUsers'
import AdminContents from '@/pages/AdminContents'
import AdminTasks from '@/pages/AdminTasks'
import AdminQuestions from '@/pages/AdminQuestions'
import AdminQuestionsType from '@/pages/AdminQuestionsType'
import AdminPapers from '@/pages/AdminPapers'
import AdminPaperPick from '@/pages/AdminPaperPick'
import AdminPaperDetail from '@/pages/AdminPaperDetail'
import AdminExams from '@/pages/AdminExams'
import AdminAIQuery from '@/pages/AdminAIQuery'
import AdminAISettings from '@/pages/AdminAISettings'
import AIChat from '@/pages/AIChat'
import { AppShell } from '@/components/AppShell'

export default function App() {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login/roles" element={<LoginRoles />} />

          <Route path="/m/home" element={<MobileHome />} />
          <Route path="/m/content/:id" element={<ContentDetail />} />
          <Route path="/m/exams" element={<MobileExams />} />
          <Route path="/m/exam/:examId" element={<MobileExamTake />} />
          <Route path="/m/exam-result/:attemptId" element={<MobileExamResult />} />
          <Route path="/m/wrong-book" element={<MobileWrongBook />} />
          <Route path="/m/report" element={<MobileReport />} />
          <Route path="/m/chat" element={<AIChat />} />
          <Route path="/m/chat/:sessionId" element={<AIChat />} />
          <Route path="/m/scores" element={<SecretaryScores />} />
          <Route path="/m/dashboard" element={<SecretaryDashboard />} />
          <Route path="/m/members" element={<SecretaryMembers />} />
          <Route path="/m/members/:userId" element={<SecretaryMembers />} />
          <Route path="/account" element={<AccountCenter />} />
          <Route path="/account/password" element={<ChangePassword />} />

          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/org" element={<AdminOrg />} />
          <Route path="/admin/org/:id" element={<AdminOrg />} />
          <Route path="/admin/org/:id/members" element={<AdminOrg />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/contents" element={<AdminContents />} />
          <Route path="/admin/tasks" element={<AdminTasks />} />
          <Route path="/admin/questions" element={<AdminQuestions />} />
          <Route path="/admin/questions/:type" element={<AdminQuestionsType />} />
          <Route path="/admin/papers" element={<AdminPapers />} />
          <Route path="/admin/papers/pick/:type" element={<AdminPaperPick />} />
          <Route path="/admin/papers/:id" element={<AdminPaperDetail />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/ai-query" element={<AdminAIQuery />} />
          <Route path="/admin/ai-settings" element={<AdminAISettings />} />
          <Route path="/admin/chat" element={<AIChat />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </Router>
  )
}
