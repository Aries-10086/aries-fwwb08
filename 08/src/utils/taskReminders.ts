/** 学习任务截止前 24 小时 Web Notification 提醒 */

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'party_school_task_reminders_v1'
const PERM_HINT_KEY = 'party_school_notif_hint_dismissed'

export type ReminderTask = {
  id: string
  title: string
  dueAt: string | null
  isCompleted?: boolean
  progressPercent?: number
}

type ReminderStore = Record<string, string> // taskId -> ISO day notified

function loadStore(): ReminderStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ReminderStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store: ReminderStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    null
  }
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** 未完成且截止时间在 (now, now+24h] 内的任务 */
export function getUpcomingDueTasks(tasks: ReminderTask[], now = Date.now()): ReminderTask[] {
  return tasks.filter((t) => {
    if (!t.dueAt) return false
    if (t.isCompleted || (t.progressPercent ?? 0) >= 100) return false
    const due = new Date(t.dueAt).getTime()
    if (!Number.isFinite(due)) return false
    const delta = due - now
    return delta > 0 && delta <= REMINDER_WINDOW_MS
  })
}

/** 已过期但仍未完成的任务（页内提示用，不发系统通知） */
export function getOverdueTasks(tasks: ReminderTask[], now = Date.now()): ReminderTask[] {
  return tasks.filter((t) => {
    if (!t.dueAt) return false
    if (t.isCompleted || (t.progressPercent ?? 0) >= 100) return false
    const due = new Date(t.dueAt).getTime()
    return Number.isFinite(due) && due < now
  })
}

function formatRemain(dueAt: string, now = Date.now()) {
  const ms = new Date(dueAt).getTime() - now
  if (ms <= 0) return '已到期'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (hours >= 1) return `剩余约 ${hours} 小时 ${mins} 分`
  return `剩余约 ${mins} 分钟`
}

export function showTaskNotification(task: ReminderTask) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false
  const remain = task.dueAt ? formatRemain(task.dueAt) : ''
  const body = task.dueAt
    ? `截止 ${new Date(task.dueAt).toLocaleString()}（${remain}），请尽快完成学习。`
    : '请尽快完成学习任务。'
  try {
    const n = new Notification('学习任务即将到期', {
      body: `「${task.title}」${body}`,
      tag: `task-due-${task.id}`,
    })
    n.onclick = () => {
      window.focus()
      n.close()
      try {
        window.location.assign('/m/home')
      } catch {
        null
      }
    }
    return true
  } catch {
    return false
  }
}

/**
 * 对 24h 内到期的未完成任务发送系统通知（同一任务同一天只提醒一次）。
 * 返回本次新发出的任务列表。
 */
export function notifyUpcomingTasks(tasks: ReminderTask[]): ReminderTask[] {
  if (!notificationSupported() || Notification.permission !== 'granted') return []
  const upcoming = getUpcomingDueTasks(tasks)
  if (upcoming.length === 0) return []

  const store = loadStore()
  const today = dayKey()
  const fired: ReminderTask[] = []

  for (const task of upcoming) {
    if (store[task.id] === today) continue
    if (showTaskNotification(task)) {
      store[task.id] = today
      fired.push(task)
    }
  }

  if (fired.length > 0) saveStore(store)
  return fired
}

export function isNotifHintDismissed() {
  try {
    return localStorage.getItem(PERM_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissNotifHint() {
  try {
    localStorage.setItem(PERM_HINT_KEY, '1')
  } catch {
    null
  }
}
