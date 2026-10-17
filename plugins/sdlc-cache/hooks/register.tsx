/**
 * cache-meter: how well this conversation's prompt cache works.
 *
 *   - `turn.step` records every main-loop request's cache usage
 *   - a one-second clock redraws the band while the countdown changes
 *   - a band above the prompt: hit rate of the last request, tokens read / written / new,
 *     and a countdown to the moment the cache lapses (the next message then re-caches everything)
 *   - `/cache` answers with the session totals; the status line carries a short summary
 *
 * It only observes: every hook hands its event on unchanged.
 *
 * Options (plugin.json userConfig): ttl (auto|5m|1h), warnSeconds, showStatus.
 */
import type { Register } from 'claude-code'

import { COLOR, advice, decideTtl, fmtClock, fmtMinutes, fmtTokens, hitRatio, kindOf, observeTtl, promptTokens, remainingMs, totals } from './cache.ts'
import type { Sample, Ttl } from './cache.ts'

const COMMAND = 'cache'
const KEEP = 200

let samples: Sample[] = []
let ttl: Ttl = '5m'
let pinned = false
let lastKey = ''
let toastedFor = 0

export const register: Register = (on, options) => {
  const warnMs = (typeof options.warnSeconds === 'number' && options.warnSeconds > 0 ? options.warnSeconds : 60) * 1000
  const showStatus = options.showStatus === true
  const asked = options.ttl

  const state = (now: number) => {
    const last = samples[samples.length - 1]
    const kind = kindOf(last, ttl, now, warnMs)
    return { last, kind, left: last ? remainingMs(last, ttl, now) : 0 }
  }

  const statusText = (now: number): string | undefined => {
    const { last, kind, left } = state(now)
    if (!last) return undefined
    return kind === 'uncached' ? 'cache' : left > 0 ? `cache ${fmtMinutes(left)}` : 'cache lapsed'
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const none = () => undefined
    const choice = decideTtl(asked, {
      enable1h: await $.env.get('ENABLE_PROMPT_CACHING_1H').catch(none),
      force5m: await $.env.get('FORCE_PROMPT_CACHING_5M').catch(none),
      ttlVar: await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL').catch(none),
    })
    ttl = choice
    pinned = asked === '5m' || asked === '1h'
    await $.command
      .register({ name: COMMAND, description: 'Prompt-cache hit rate, session totals and time until the cache lapses' })
      .catch(err => $.ui.log(`cache-meter: /${COMMAND} not registered: ${err}`))

    $.clock.every(1000, () => {
      const now = Date.now()
      const { last, kind, left } = state(now)
      const key = `${kind}|${left > 0 ? fmtMinutes(left) : ''}`
      if (key !== lastKey) {
        lastKey = key
        if (showStatus) $.ui.status(statusText(now))
        $.ui.invalidate('ui.render')
      }
      if (last && left > 0 && left <= warnMs && promptTokens(last) >= 20_000 && toastedFor !== last.startedAt) {
        toastedFor = last.startedAt
        $.ui.toast(`cache lapses in ${Math.ceil(left / 1000)}s: send a message to keep ${fmtTokens(promptTokens(last))} tokens warm`)
      }
    })
    return r
  })

  on('session.end', async ($, e, next) => {
    // /clear starts a new conversation in the same process: its cache is a new one
    if (e.reason === 'clear') {
      samples = []
      lastKey = ''
      toastedFor = 0
      $.ui.status(undefined)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // each main-loop request: what the cache did with it
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    const startedAt = Date.now()
    const r = yield* next(e)
    if (r.usage) {
      const sample: Sample = {
        model: r.usage.model || e.model,
        startedAt,
        read: r.usage.cache_read_input_tokens,
        write: r.usage.cache_creation_input_tokens,
        fresh: r.usage.input_tokens,
        output: r.usage.output_tokens,
      }
      if (!pinned) {
        const seen = observeTtl(samples[samples.length - 1], sample)
        if (seen) ttl = seen
      }
      samples.push(sample)
      if (samples.length > KEEP) samples = samples.slice(-KEEP)
      lastKey = ''
      if (showStatus) $.ui.status(statusText(Date.now()))
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('command.run', { command: COMMAND }, async () => {
    const now = Date.now()
    const { last, kind, left } = state(now)
    if (!last) return { text: 'cache: no request yet in this conversation.' }
    const t = totals(samples)
    const lines = [
      `${advice(kind, last)}${left > 0 ? ` (${fmtClock(left)} left of ${ttl})` : ` (${ttl} cache)`}`,
      `last request: ${Math.round(hitRatio(last) * 100)}% from cache · read ${fmtTokens(last.read)} · wrote ${fmtTokens(last.write)} · new ${fmtTokens(last.fresh)}`,
      `session: ${t.requests} requests · ${Math.round(t.ratio * 100)}% from cache · read ${fmtTokens(t.read)} · wrote ${fmtTokens(t.write)} · new ${fmtTokens(t.fresh)}`,
    ]
    return { text: lines.join('\n') }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const now = Date.now()
    const { last, kind, left } = state(now)
    if (!last) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // whatever the plugins beneath draw (another mod's band) stays, under this line
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text color={COLOR[kind]}>{kind === 'uncached' ? '○' : '●'}</Text>
          <Text dimColor>cache</Text>
          {kind === 'warm' && <Text dimColor>{fmtMinutes(left)}</Text>}
          {kind === 'soon' && <Text color="yellow">{fmtMinutes(left)}</Text>}
          {kind === 'expired' && <Text color="red">lapsed</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
