import { describe, expect, it } from 'vitest'
import {
  getRelativeDate,
  parseDate,
  parseEndOf,
  parseReminderText,
  toIsoDateTime,
} from '../dates'

// Fixed base date: Wednesday, 2025-01-15 (isoweekday 3), midday UTC.
const BASE = new Date('2025-01-15T12:00:00Z')
const UTC = 'UTC'

describe('parseDate', () => {
  it('handles today and tomorrow', () => {
    expect(parseDate('today', UTC, BASE)).toBe('2025-01-15')
    expect(parseDate('tomorrow', UTC, BASE)).toBe('2025-01-16')
  })

  it("handles 'in X days/weeks'", () => {
    expect(parseDate('in 3 days', UTC, BASE)).toBe('2025-01-18')
    expect(parseDate('in 2 weeks', UTC, BASE)).toBe('2025-01-29')
  })

  it('handles next weekday (always in the following week)', () => {
    // Matches the CLI formula: days_until = 7 - wd + target, +7 if <= 7.
    // Base is Wed (3). Next Monday(1): 7-3+1=5 -> +7 = 12 days => 2025-01-27.
    expect(parseDate('next Monday', UTC, BASE)).toBe('2025-01-27')
    // Next Wednesday(3): 7-3+3=7 -> +7 = 14 days => 2025-01-29.
    expect(parseDate('next Wednesday', UTC, BASE)).toBe('2025-01-29')
  })

  it('handles this weekday and bare weekday', () => {
    // This Friday => 2 days out.
    expect(parseDate('this Friday', UTC, BASE)).toBe('2025-01-17')
    expect(parseDate('friday', UTC, BASE)).toBe('2025-01-17')
    // A weekday already passed this week rolls to next week.
    expect(parseDate('monday', UTC, BASE)).toBe('2025-01-20')
  })

  it('passes through ISO dates', () => {
    expect(parseDate('2025-04-15', UTC, BASE)).toBe('2025-04-15')
  })

  it('returns null for gibberish', () => {
    expect(parseDate('asdfqwerty', UTC, BASE)).toBeNull()
  })
})

describe('toIsoDateTime', () => {
  it('defaults to end-of-day UTC when no tz', () => {
    expect(toIsoDateTime('2025-01-15', true)).toBe('2025-01-15T23:59:59.000Z')
    expect(toIsoDateTime('2025-01-15', false)).toBe('2025-01-15T00:00:00.000Z')
  })

  it('converts end-of-day in a tz to UTC', () => {
    // 23:59:59 in America/New_York (UTC-5 in January) => next day 04:59:59 UTC.
    expect(toIsoDateTime('2025-01-15', true, 'America/New_York')).toBe(
      '2025-01-16T04:59:59.000Z'
    )
  })
})

describe('parseEndOf', () => {
  it('eod is today end-of-day', () => {
    expect(parseEndOf('eod', UTC, BASE)).toBe('2025-01-15T23:59:59.000Z')
  })

  it('eow is Friday of this week', () => {
    expect(parseEndOf('end of week', UTC, BASE)).toBe(
      '2025-01-17T23:59:59.000Z'
    )
  })

  it('eom is last day of month', () => {
    expect(parseEndOf('eom', UTC, BASE)).toBe('2025-01-31T23:59:59.000Z')
  })

  it('returns null for non end-of patterns', () => {
    expect(parseEndOf('tomorrow', UTC, BASE)).toBeNull()
  })
})

describe('getRelativeDate', () => {
  it('day/week/month windows', () => {
    expect(getRelativeDate('day', UTC, BASE)).toBe('2025-01-15T23:59:59.000Z')
    expect(getRelativeDate('week', UTC, BASE)).toBe('2025-01-22T23:59:59.000Z')
    expect(getRelativeDate('month', UTC, BASE)).toBe('2025-02-12T23:59:59.000Z')
  })
})

describe('parseReminderText', () => {
  it('strips prefixes and parses eod', () => {
    const r = parseReminderText(
      'remind me to water the plants by end of day',
      UTC,
      BASE
    )
    expect(r.title).toBe('Water the plants')
    expect(r.dueDate).toBe('2025-01-15T23:59:59.000Z')
  })

  it("parses 'by eow'", () => {
    const r = parseReminderText('repot the fern by eow', UTC, BASE)
    expect(r.title).toBe('Repot the fern')
    expect(r.dueDate).toBe('2025-01-17T23:59:59.000Z')
  })

  it("parses 'on <weekday>'", () => {
    const r = parseReminderText('prune the roses on Friday', UTC, BASE)
    expect(r.title).toBe('Prune the roses')
    expect(r.dueDate).toBe('2025-01-17T23:59:59.000Z')
  })

  it('parses trailing bare date', () => {
    const r = parseReminderText('water the plants tomorrow', UTC, BASE)
    expect(r.title).toBe('Water the plants')
    expect(r.dueDate).toBe('2025-01-16T23:59:59.000Z')
  })

  it('keeps title when no date present', () => {
    const r = parseReminderText('mist the orchids', UTC, BASE)
    expect(r.title).toBe('Mist the orchids')
    expect(r.dueDate).toBeNull()
    expect(r.priority).toBeUndefined()
  })

  it('strips trailing !important and sets urgent priority', () => {
    const r = parseReminderText('water the cactus !important', UTC, BASE)
    expect(r.title).toBe('Water the cactus')
    expect(r.priority).toBe(1)
    expect(r.dueDate).toBeNull()
  })

  it('supports !urgent and combines with a due date', () => {
    const r = parseReminderText(
      'fertilize the garden by eod !urgent',
      UTC,
      BASE
    )
    expect(r.title).toBe('Fertilize the garden')
    expect(r.priority).toBe(1)
    expect(r.dueDate).toBe('2025-01-15T23:59:59.000Z')
  })

  it('supports other priority levels via !<priority>', () => {
    expect(parseReminderText('mow the lawn !high', UTC, BASE).priority).toBe(2)
    expect(parseReminderText('rake leaves !medium', UTC, BASE).priority).toBe(3)
    expect(parseReminderText('water the moss !low', UTC, BASE).priority).toBe(4)
    expect(parseReminderText('dust the leaves !none', UTC, BASE).priority).toBe(
      0
    )
  })

  it('strips the priority marker but keeps the date and title', () => {
    const r = parseReminderText('trim the hedge by eow !low', UTC, BASE)
    expect(r.title).toBe('Trim the hedge')
    expect(r.priority).toBe(4)
    expect(r.dueDate).toBe('2025-01-17T23:59:59.000Z')
  })

  it('only strips the marker at the end', () => {
    const r = parseReminderText('important repotting on Friday', UTC, BASE)
    expect(r.title).toBe('Important repotting')
    expect(r.priority).toBeUndefined()
    expect(r.dueDate).toBe('2025-01-17T23:59:59.000Z')
  })
})
