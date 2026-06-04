/**
 * Smart date parsing — a TypeScript port of the linear-todos Python
 * `DateParser` (src/linear_todos/dates.py), so behavior matches the CLI.
 *
 * All "due date" outputs are ISO datetime strings in UTC (with a `Z` suffix),
 * representing end-of-day in the configured timezone.
 */
import * as chrono from 'chrono-node'
import type { Todo } from './linear'

const DAY_MAP: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

const WEEKDAY_PATTERN =
  'monday|tuesday|wednesday|thursday|friday|saturday|sunday'

/** ISO weekday for a Date in a given IANA timezone (1=Mon … 7=Sun). */
function isoWeekday(date: Date, timeZone?: string): number {
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone,
  }).format(date)
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  return map[day] ?? 1
}

/** The civil (Y/M/D) date in a given timezone, as a plain object. */
function civilDate(
  date: Date,
  timeZone?: string
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDateString(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Add days to a YYYY-MM-DD string using UTC math; return YYYY-MM-DD. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return toIsoDateString(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate()
  )
}

/** Today's date (YYYY-MM-DD) in the given timezone. */
function todayIso(timeZone: string | undefined, base: Date): string {
  const { year, month, day } = civilDate(base, timeZone)
  return toIsoDateString(year, month, day)
}

/**
 * Parse a natural-language date into YYYY-MM-DD. Mirrors DateParser.parse.
 * Returns null when nothing matches.
 */
export function parseDate(
  input: string,
  timeZone?: string,
  base: Date = new Date()
): string | null {
  if (!input) {
    return null
  }

  const lower = input.toLowerCase().trim()
  const today = todayIso(timeZone, base)
  const todayWeekday = isoWeekday(base, timeZone)

  if (lower === 'today') {
    return today
  }
  if (lower === 'tomorrow') {
    return addDays(today, 1)
  }

  // "in X days/weeks"
  let m = lower.match(/^in\s+(\d+)\s+(day|days|week|weeks)$/)
  if (m) {
    let num = parseInt(m[1], 10)
    if (m[2].startsWith('week')) {
      num *= 7
    }
    return addDays(today, num)
  }

  // "next <weekday>" — always at least 7 days out
  m = lower.match(new RegExp(`^next\\s+(${WEEKDAY_PATTERN})$`))
  if (m) {
    const target = DAY_MAP[m[1]]
    let daysUntil = 7 - todayWeekday + target
    if (daysUntil <= 7) {
      daysUntil += 7
    }
    return addDays(today, daysUntil)
  }

  // "this <weekday>" — current week, or next if already passed
  m = lower.match(new RegExp(`^this\\s+(${WEEKDAY_PATTERN})$`))
  if (m) {
    const target = DAY_MAP[m[1]]
    let daysUntil = target - todayWeekday
    if (daysUntil <= 0) {
      daysUntil += 7
    }
    return addDays(today, daysUntil)
  }

  // Bare weekday (same as "this <weekday>")
  if (lower in DAY_MAP) {
    const target = DAY_MAP[lower]
    let daysUntil = target - todayWeekday
    if (daysUntil <= 0) {
      daysUntil += 7
    }
    return addDays(today, daysUntil)
  }

  // "in X weeks on <weekday>"
  m = lower.match(
    new RegExp(`^in\\s+(\\d+)\\s+weeks?\\s+on\\s+(${WEEKDAY_PATTERN})$`)
  )
  if (m) {
    const weeks = parseInt(m[1], 10)
    const target = DAY_MAP[m[2]]
    const baseDays = weeks * 7
    let daysUntil = target - todayWeekday
    if (daysUntil <= 0) {
      daysUntil += 7
    }
    return addDays(today, baseDays + daysUntil)
  }

  // ISO date passed through directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim()
  }

  // Fallback: chrono-node (replaces Python dateparser; forwardDate ≈ future).
  // Only accept a result that consumes (essentially) the whole input, so that
  // free text like "water the plants tomorrow" is not treated as a bare date here —
  // the reminder parser handles trailing-date extraction separately.
  const parsed = chrono.parse(input, base, { forwardDate: true })
  if (parsed.length > 0) {
    const match = parsed[0]
    const consumed = match.text.trim()
    if (consumed.length === input.trim().length) {
      const dt = match.start.date()
      return toIsoDateString(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    }
  }

  return null
}

/**
 * Convert a YYYY-MM-DD date to an ISO UTC datetime, defaulting to end-of-day
 * (23:59:59) in the given timezone. Mirrors DateParser.to_iso_datetime.
 */
export function toIsoDateTime(
  dateStr: string,
  endOfDay = true,
  timeZone?: string
): string {
  if (!timeZone) {
    // UTC behavior (matches CLI default when no tz configured).
    return endOfDay ? `${dateStr}T23:59:59.000Z` : `${dateStr}T00:00:00.000Z`
  }

  const time = endOfDay ? { h: 23, mi: 59, s: 59 } : { h: 0, mi: 0, s: 0 }

  // Find the UTC instant whose wall-clock time in `timeZone` equals the target.
  const [y, mo, d] = dateStr.split('-').map(Number)
  // Start from the naive UTC guess, then correct by the zone offset at that moment.
  const naiveUtc = Date.UTC(y, mo - 1, d, time.h, time.mi, time.s)
  const offsetMs = timeZoneOffsetMs(new Date(naiveUtc), timeZone)
  const corrected = new Date(naiveUtc - offsetMs)
  return corrected.toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

/** Offset (ms) of `timeZone` from UTC at the given instant (e.g. -5h => -18000000). */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second')
  )
  return asUtc - date.getTime()
}

/**
 * Parse "end of day/week/month" (and eod/eow/eom). Mirrors parse_end_of.
 * Returns an ISO UTC datetime string or null.
 */
export function parseEndOf(
  input: string,
  timeZone?: string,
  base: Date = new Date()
): string | null {
  if (!input) {
    return null
  }
  const lower = input.toLowerCase().trim()
  const today = todayIso(timeZone, base)

  if (
    ['end of day', 'eod', 'by end of day', 'by eod'].some((x) =>
      lower.includes(x)
    )
  ) {
    return toIsoDateTime(today, true, timeZone)
  }

  if (
    ['end of week', 'eow', 'by end of week', 'by eow'].some((x) =>
      lower.includes(x)
    )
  ) {
    const todayWeekday = isoWeekday(base, timeZone)
    let daysUntilFriday = 5 - todayWeekday
    if (daysUntilFriday < 0) {
      daysUntilFriday += 7
    }
    return toIsoDateTime(addDays(today, daysUntilFriday), true, timeZone)
  }

  if (
    ['end of month', 'eom', 'by end of month', 'by eom'].some((x) =>
      lower.includes(x)
    )
  ) {
    const [y, mo] = today.split('-').map(Number)
    // First day of next month, minus one day.
    const firstNext = mo === 12 ? Date.UTC(y + 1, 0, 1) : Date.UTC(y, mo, 1)
    const last = new Date(firstNext - 86_400_000)
    const lastIso = toIsoDateString(
      last.getUTCFullYear(),
      last.getUTCMonth() + 1,
      last.getUTCDate()
    )
    return toIsoDateTime(lastIso, true, timeZone)
  }

  return null
}

/** Relative window: day/week/month → end-of-day today/+7/+28. */
export function getRelativeDate(
  when: 'day' | 'week' | 'month',
  timeZone?: string,
  base: Date = new Date()
): string | null {
  const today = todayIso(timeZone, base)
  let date: string
  if (when === 'day') {
    date = today
  } else if (when === 'week') {
    date = addDays(today, 7)
  } else if (when === 'month') {
    date = addDays(today, 28)
  } else {
    return null
  }
  return toIsoDateTime(date, true, timeZone)
}

/**
 * Maps the words accepted by the trailing "!<priority>" reminder marker to
 * Linear priority numbers (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low).
 * "important" is an alias for urgent; "medium" maps to Normal.
 */
const PRIORITY_WORD_TO_NUMBER: Record<string, number> = {
  important: 1,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
  none: 0,
}

/**
 * Parse reminder text into { title, dueDate, priority }. Port of
 * _parse_reminder_text, plus a trailing "!<priority>" marker.
 * dueDate is an ISO UTC datetime string or null.
 */
export function parseReminderText(
  text: string,
  timeZone?: string,
  base: Date = new Date()
): { title: string; dueDate: string | null; priority?: number } {
  const lower = text.toLowerCase()
  const prefixes = [
    'remind me to ',
    'remind me about ',
    'remind me ',
    'remind to ',
    'remind ',
  ]
  let clean = text
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      clean = text.slice(prefix.length).trim()
      break
    }
  }

  // A trailing "!<priority>" marker sets the priority and is stripped from
  // the title. Examples: !urgent, !important (alias for urgent), !high,
  // !medium, !low, !none. Stripped before date parsing so it can't interfere
  // with trailing dates.
  let priority: number | undefined
  const priorityMatch = clean.match(
    /\s*!\s*(important|urgent|high|medium|low|none)\s*$/i
  )
  if (priorityMatch && priorityMatch.index !== undefined) {
    priority = PRIORITY_WORD_TO_NUMBER[priorityMatch[1].toLowerCase()]
    clean = clean.slice(0, priorityMatch.index).trim()
  }

  let dueDate: string | null = null
  let title = clean

  const byPatterns: [RegExp, string][] = [
    [/\s+by\s+end\s+of\s+day$/, 'end of day'],
    [/\s+by\s+eod$/, 'eod'],
    [/\s+by\s+end\s+of\s+week$/, 'end of week'],
    [/\s+by\s+eow$/, 'eow'],
    [/\s+by\s+end\s+of\s+month$/, 'end of month'],
    [/\s+by\s+eom$/, 'eom'],
  ]

  for (const [pattern, dateType] of byPatterns) {
    const match = clean.toLowerCase().match(pattern)
    if (match && match.index !== undefined) {
      title = clean.slice(0, match.index).trim()
      dueDate = parseEndOf(dateType, timeZone, base)
      break
    }
  }

  // "... on <date>"
  if (!dueDate) {
    const onMatch = clean.match(/\s+on\s+(.+)$/i)
    if (onMatch && onMatch.index !== undefined) {
      const dateStr = onMatch[1].trim()
      title = clean.slice(0, onMatch.index).trim()
      const parsed = parseDate(dateStr, timeZone, base)
      if (parsed) {
        dueDate = toIsoDateTime(parsed, true, timeZone)
      }
    }
  }

  // "... by <date>"
  if (!dueDate) {
    const byMatch = clean.match(/\s+by\s+(.+)$/i)
    if (byMatch && byMatch.index !== undefined) {
      const dateStr = byMatch[1].trim()
      title = clean.slice(0, byMatch.index).trim()
      dueDate = parseEndOf(dateStr, timeZone, base)
      if (!dueDate) {
        const parsed = parseDate(dateStr, timeZone, base)
        if (parsed) {
          dueDate = toIsoDateTime(parsed, true, timeZone)
        }
      }
    }
  }

  // Trailing bare date (e.g. "water the plants tomorrow")
  if (!dueDate) {
    const words = clean.split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const potential = words.slice(i).join(' ')
      dueDate = parseEndOf(potential, timeZone, base)
      if (!dueDate) {
        const parsed = parseDate(potential, timeZone, base)
        if (parsed) {
          dueDate = toIsoDateTime(parsed, true, timeZone)
          title = words.slice(0, i).join(' ').trim()
          break
        }
      } else {
        title = words.slice(0, i).join(' ').trim()
        break
      }
    }
  }

  title = title.trim()
  if (title.length > 0) {
    title = title[0].toUpperCase() + title.slice(1)
  }

  return { title, dueDate, priority }
}

// ---------------------------------------------------------------------------
// Urgency bucketing for the List / Review / Digest views.
// ---------------------------------------------------------------------------

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

/** Whole-day delta between a due date and today (UTC date math). */
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

/** Resolve the effective timezone: explicit pref, else system zone. */
export function effectiveTimeZone(pref?: string): string {
  const trimmed = pref?.trim()
  if (trimmed) {
    return trimmed
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
