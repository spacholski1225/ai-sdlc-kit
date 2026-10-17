// The pure half of cache-meter: what each request did to the prompt cache and
// when the entry lapses. No engine calls, so the tests drive it directly.
//
// A request's prompt is `input_tokens` (uncached remainder) + `cache_read` +
// `cache_creation`. The cache lives 5 minutes, or 1 hour when asked for, and
// the lifetime is counted from the START of the request that wrote or read it.

export type Ttl = '5m' | '1h'

export type Sample = {
  model: string
  /** ms since the epoch when the request started */
  startedAt: number
  read: number
  write: number
  fresh: number
  output: number
}

export type Kind = 'warm' | 'soon' | 'expired' | 'uncached'

export const ttlMs = (ttl: Ttl) => (ttl === '1h' ? 3_600_000 : 300_000)

export const promptTokens = (s: Sample) => s.read + s.write + s.fresh

/** Share of the prompt the cache served, 0 to 1. */
export function hitRatio(s: Sample): number {
  const total = promptTokens(s)
  return total === 0 ? 0 : s.read / total
}

export type Totals = { requests: number; read: number; write: number; fresh: number; ratio: number }

export function totals(samples: readonly Sample[]): Totals {
  const t = { requests: samples.length, read: 0, write: 0, fresh: 0, ratio: 0 }
  for (const s of samples) {
    t.read += s.read
    t.write += s.write
    t.fresh += s.fresh
  }
  const all = t.read + t.write + t.fresh
  t.ratio = all === 0 ? 0 : t.read / all
  return t
}

/** ms until the entry the sample touched lapses; 0 when it touched none. */
export function remainingMs(s: Sample, ttl: Ttl, now: number): number {
  if (s.read + s.write === 0) return 0
  return Math.max(0, s.startedAt + ttlMs(ttl) - now)
}

export function kindOf(s: Sample | undefined, ttl: Ttl, now: number, warnMs: number): Kind {
  if (!s || s.read + s.write === 0) return 'uncached'
  const left = remainingMs(s, ttl, now)
  if (left === 0) return 'expired'
  return left <= warnMs ? 'soon' : 'warm'
}

/**
 * The lifetime in force. An explicit option wins, then Claude Code's own
 * switch for five minutes; otherwise one hour, the lifetime this conversation is
 * kept warm for. observeTtl corrects it when the request timing says otherwise.
 */
export function decideTtl(option: unknown, env: { enable1h?: string; force5m?: string; ttlVar?: string }): Ttl {
  if (option === '5m' || option === '1h') return option
  const on = (v: string | undefined) => v === '1' || v?.toLowerCase() === 'true'
  if (on(env.force5m)) return '5m'
  if (env.ttlVar === '5m' || env.ttlVar === '1h') return env.ttlVar
  return '1h'
}

/**
 * What the gap between two requests shows. After more than five minutes (and
 * under an hour) a read can only come from a one-hour entry, and a full miss
 * after a cached request means the entry lived five minutes.
 */
export function observeTtl(prev: Sample | undefined, next: Sample): Ttl | undefined {
  if (!prev) return undefined
  const gap = next.startedAt - prev.startedAt
  if (gap <= ttlMs('5m') + 15_000 || gap >= ttlMs('1h')) return undefined
  if (next.read > 0) return '1h'
  if (prev.read + prev.write > 0 && next.write > 0) return '5m'
  return undefined
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Whole minutes left, rounded up: 54m. */
export const fmtMinutes = (ms: number) => `${Math.max(1, Math.ceil(ms / 60_000))}m`

export function bar(ratio: number, width: number): string {
  const full = Math.round(Math.min(1, Math.max(0, ratio)) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

export const COLOR: Record<Kind, string> = { warm: 'green', soon: 'yellow', expired: 'red', uncached: 'gray' }

/** One sentence for the person: what the cache is doing and what to do about it. */
export function advice(kind: Kind, last: Sample | undefined): string {
  switch (kind) {
    case 'warm':
      return 'cache is warm, the next message is cheap'
    case 'soon':
      return 'cache lapses soon, send something to keep it'
    case 'expired':
      return `cache lapsed, the next message re-caches ${last ? fmtTokens(promptTokens(last)) : 'the'} tokens`
    case 'uncached':
      return 'no cache entry yet (first request, or caching is off)'
  }
}
