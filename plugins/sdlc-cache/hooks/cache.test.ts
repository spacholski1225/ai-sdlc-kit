import { describe, expect, test } from 'claude-code/testing'

import { advice, bar, decideTtl, fmtClock, fmtMinutes, fmtTokens, hitRatio, kindOf, observeTtl, remainingMs, totals } from './cache.ts'
import type { Sample } from './cache.ts'

const sample = (o: Partial<Sample> = {}): Sample => ({ model: 'm', startedAt: 0, read: 900, write: 0, fresh: 100, output: 10, ...o })

describe('hit rate', () => {
  test('is read over the whole prompt', () => {
    expect(hitRatio(sample())).toBe(0.9)
    expect(hitRatio(sample({ read: 0, write: 0, fresh: 0 }))).toBe(0)
  })
  test('totals add up the session', () => {
    const t = totals([sample(), sample({ read: 0, write: 1000, fresh: 0 })])
    expect(t.requests).toBe(2)
    expect(t.read).toBe(900)
    expect(t.write).toBe(1000)
  })
})

describe('lifetime', () => {
  test('the countdown runs from the start of the request', () => {
    expect(remainingMs(sample(), '5m', 100_000)).toBe(200_000)
    expect(remainingMs(sample(), '5m', 400_000)).toBe(0)
    expect(remainingMs(sample(), '1h', 400_000)).toBe(3_200_000)
  })
  test('kinds', () => {
    expect(kindOf(undefined, '5m', 0, 60_000)).toBe('uncached')
    expect(kindOf(sample(), '5m', 100_000, 60_000)).toBe('warm')
    expect(kindOf(sample(), '5m', 260_000, 60_000)).toBe('soon')
    expect(kindOf(sample(), '5m', 301_000, 60_000)).toBe('expired')
    expect(kindOf(sample({ read: 0, write: 0 }), '5m', 0, 60_000)).toBe('uncached')
  })
  test('ttl comes from the option, then the switches', () => {
    expect(decideTtl('1h', { force5m: '1' })).toBe('1h')
    expect(decideTtl('auto', { force5m: '1', enable1h: '1' })).toBe('5m')
    expect(decideTtl('auto', { enable1h: '1' })).toBe('1h')
    expect(decideTtl('auto', {})).toBe('1h')
    expect(decideTtl('auto', { ttlVar: '5m' })).toBe('5m')
  })
  test('the gap between requests corrects the lifetime', () => {
    expect(observeTtl(sample({ startedAt: 0 }), sample({ startedAt: 20 * 60_000 }))).toBe('1h')
    expect(observeTtl(sample({ startedAt: 0 }), sample({ startedAt: 60_000 }))).toBeUndefined()
    expect(observeTtl(sample({ startedAt: 0 }), sample({ startedAt: 20 * 60_000, read: 0, write: 1000 }))).toBe('5m')
    expect(observeTtl(sample({ startedAt: 0 }), sample({ startedAt: 2 * 3_600_000, read: 0, write: 1000 }))).toBeUndefined()
  })
})

test('formatting', () => {
  expect(fmtTokens(950)).toBe('950')
  expect(fmtTokens(184_300)).toBe('184.3k')
  expect(fmtClock(272_000)).toBe('4:32')
  expect(fmtClock(3_725_000)).toBe('1:02:05')
  expect(fmtMinutes(54 * 60_000 - 1)).toBe('54m')
  expect(fmtMinutes(10_000)).toBe('1m')
  expect(bar(0.5, 10)).toBe('█████░░░░░')
  expect(advice('expired', sample())).toContain('1k tokens')
})
