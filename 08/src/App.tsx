import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import LoginRoles from '@/pages/LoginRoles'
import MobileHome from '@/pages/MobileHome'
import ContentDetail from '@/pages/ContentDetail'
import MobileExams from '@/pages/MobileExams'
import MobileExamTake from '@/pages/MobileExamTake'
import MobileReport from '@/pages/MobileReport'
import SecretaryScores from '@/pages/SecretaryScores'
import AdminDashboard from '@/pages/AdminDashboard'
import AdminOrg from '@/pages/AdminOrg'
import AdminUsers from '@/pages/AdminUsers'
import AdminContents from '@/pages/AdminContents'
import AdminTasks from '@/pages/AdminTasks'
import AdminQuestions from '@/pages/AdminQuestions'
import AdminPapers from '@/pages/AdminPapers'
import AdminExams from '@/pages/AdminExams'
import AdminAIQuery from '@/pages/AdminAIQuery'
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
          <Route path="/m/report" element={<MobileReport />} />
          <Route path="/m/scores" element={<SecretaryScores />} />

          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/org" element={<AdminOrg />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/contents" element={<AdminContents />} />
          <Route path="/admin/tasks" element={<AdminTasks />} />
          <Route path="/admin/questions" element={<AdminQuestions />} />
          <Route path="/admin/papers" element={<AdminPapers />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/ai-query" element={<AdminAIQuery />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </Router>
  )
}
