import { useCallback, useEffect, useState } from 'react'
import {
  dismissNotifHint,
  getNotificationPermission,
  getOverdueTasks,
  getUpcomingDueTasks,
  isNotifHintDismissed,
  notificationSupported,
  notifyUpcomingTasks,
  requestNotificationPermission,
  type ReminderTask,
} from '@/utils/taskReminders'

const POLL_MS = 15 * 60 * 1000

export function useTaskReminders(tasks: ReminderTask[], enabled: boolean) {
  const [permission, setPermission] = useState(getNotificationPermission)
  const [hintVisible, setHintVisible] = useState(
    () => notificationSupported() && !isNotifHintDismissed() && getNotificationPermission() === 'default',
  )
  const [lastFiredAt, setLastFiredAt] = useState<number | null>(null)

  const upcoming = enabled ? getUpcomingDueTasks(tasks) : []
  const overdue = enabled ? getOverdueTasks(tasks) : []

  const runNotify = useCallback(() => {
    if (!enabled) return
    const fired = notifyUpcomingTasks(tasks)
    if (fired.length > 0) setLastFiredAt(Date.now())
    setPermission(getNotificationPermission())
  }, [enabled, tasks])

  useEffect(() => {
    if (!enabled) return
    runNotify()
    const timer = window.setInterval(runNotify, POLL_MS)
    const onFocus = () => runNotify()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, runNotify])

  async function enableNotifications() {
    const perm = await requestNotificationPermission()
    setPermission(perm)
    if (perm === 'granted') {
      setHintVisible(false)
      runNotify()
    }
    return perm
  }

  function dismissHint() {
    dismissNotifHint()
    setHintVisible(false)
  }

  return {
    supported: notificationSupported(),
    permission,
    hintVisible,
    upcoming,
    overdue,
    lastFiredAt,
    enableNotifications,
    dismissHint,
    runNotify,
  }
}
