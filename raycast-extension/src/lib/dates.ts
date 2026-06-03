import type { Todo } from './cli'

export type Bucket = 'overdue' | 'today' | 'week' | 'month' | 'later' | 'none'

export const BUCKET_TITLES: Record<Bucket, string> = {
  overdue: '🚨 Overdue',
  today: '📅 Due Today',
  week: '📊 This Week',
  month: '🗓️ This Month',
  later: '⏳ Later',
  none: '📝 No Due Date',
}

export const BUCKET_ORDER: Bucket[] = [
  'overdue',
  'today',
  'week',
  'month',
  'later',
  'none',
]

/** Days from today (UTC date math, matching the CLI's review logic). */
function dayDelta(dueDate: string): number | null {
  const datePart = dueDate.split('T')[0]
  const due = new Date(`${datePart}T00:00:00Z`)
  if (Number.isNaN(due.getTime())) {
    return null
  }
  const now = new Date()
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  const dueUtc = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  )
  return Math.round((dueUtc - todayUtc) / 86_400_000)
}

export function bucketFor(todo: Todo): Bucket {
  if (!todo.dueDate) {
    return 'none'
  }
  const delta = dayDelta(todo.dueDate)
  if (delta === null) {
    return 'none'
  }
  if (delta < 0) return 'overdue'
  if (delta === 0) return 'today'
  if (delta <= 7) return 'week'
  if (delta <= 28) return 'month'
  return 'later'
}

export function groupByBucket(todos: Todo[]): Map<Bucket, Todo[]> {
  const map = new Map<Bucket, Todo[]>()
  for (const bucket of BUCKET_ORDER) {
    map.set(bucket, [])
  }
  for (const todo of todos) {
    if (todo.archivedAt) {
      continue
    }
    map.get(bucketFor(todo))!.push(todo)
  }
  return map
}

export function formatDueDate(dueDate?: string | null): string {
  if (!dueDate) {
    return ''
  }
  return dueDate.split('T')[0]
}
