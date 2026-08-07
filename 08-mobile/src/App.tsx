import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MobileShell } from '@/components/MobileShell'
import Login from '@/pages/Login'
import AdminTip from '@/pages/AdminTip'
import Home from '@/pages/Home'
import Exams from '@/pages/Exams'
import ExamTake from '@/pages/ExamTake'
import ExamResult from '@/pages/ExamResult'
import WrongBook from '@/pages/WrongBook'
import Report from '@/pages/Report'
import Account from '@/pages/Account'
import ContentDetail from '@/pages/ContentDetail'
import Dashboard from '@/pages/Dashboard'
import Scores from '@/pages/Scores'
import Chat from '@/pages/Chat'
import Tasks from '@/pages/Tasks'
import Members from '@/pages/Members'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin-tip" element={<AdminTip />} />

        <Route element={<MobileShell />}>
          <Route path="/home" element={<Home />} />
          <Route path="/content/:id" element={<ContentDetail />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exam/:examId" element={<ExamTake />} />
          <Route path="/exam-result/:attemptId" element={<ExamResult />} />
          <Route path="/wrong-book" element={<WrongBook />} />
          <Route path="/report" element={<Report />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/account" element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:userId" element={<Members />} />
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
