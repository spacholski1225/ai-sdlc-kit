/**
 * sdlc-guard: three guards on `tool.call`, all in one place.
 *
 *   1. Bash: denies destructive commands (rm -rf of a root, force push, reset --hard ...)
 *   2. Bash: commit hygiene: no Co-Authored-By trailer, no `git add -A` / `git commit -a`,
 *      no staging of files that stay local (.env, docker-compose.override.yml, *.local)
 *   3. every tool: redacts credential-shaped strings from the result before the model reads it
 *
 * Pure logic lives in ./rules.ts. A guard that fails never lets a call through unchecked.
 *
 * Options (plugin.json userConfig):
 *   patterns:   extra deny regexes for Bash, comma-separated
 *   localFiles: extra regexes for files that must not be staged, comma-separated
 *   coAuthor, blanketStaging, localFileRule, redactSecrets: set false to switch one guard off
 */
import type { Register } from 'claude-code'

import { DESTRUCTIVE, SECRETS, gitViolation, redactDeep, strings } from './rules.ts'
import type { Pattern, Rule } from './rules.ts'

const compile = (sources: string[], flags = ''): RegExp[] => {
  const out: RegExp[] = []
  for (const s of sources) {
    try {
      out.push(new RegExp(s, flags))
    } catch {
      // a pattern that does not compile is skipped, never a reason to lose the built-in rules
    }
  }
  return out
}

export const register: Register = (on, options) => {
  const extraDeny: Rule[] = compile(strings(options.patterns)).map(pattern => ({ pattern, reason: `custom pattern ${pattern.source}` }))
  const rules = [...DESTRUCTIVE, ...extraDeny]
  const hygiene = {
    coAuthor: options.coAuthor !== false,
    blanketStaging: options.blanketStaging !== false,
    localFiles: options.localFileRule !== false,
    extraLocal: compile(strings(options.localFiles)),
  }
  const redact = options.redactSecrets !== false
  const patterns: readonly Pattern[] = [...SECRETS, ...compile(strings(options.secretPatterns), 'g').map(re => ({ name: 'custom', re }))]

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash') {
      const why = rules.find(r => r.pattern.test(e.command))?.reason ?? gitViolation(e.command, hygiene)
      if (why) {
        $.ui.log(`[sdlc-guard] denied Bash call: ${why}`)
        return { deny: `Blocked by sdlc-guard: ${why}. If this is intended, ask the user to do it themselves.` }
      }
      if (redact && e.command.includes('[REDACTED:')) {
        return { deny: 'sdlc-guard: the command holds a redacted placeholder. Read the value from an environment variable instead.' }
      }
    }

    const outcome = await next(e)
    if (!redact) return outcome
    const hits = new Set<string>()
    const cleaned = redactDeep(outcome, patterns, hits)
    if (hits.size === 0) return outcome

    const kinds = [...hits].join(', ')
    $.ui.log(`[sdlc-guard] redacted ${kinds} from ${e.tool} output`)
    if (cleaned.deny !== undefined) return cleaned
    return {
      ...cleaned,
      context: [
        ...(cleaned.context ?? []),
        `sdlc-guard replaced ${hits.size} kind(s) of secret (${kinds}) with [REDACTED:*] placeholders. Never paste a placeholder into a command.`,
      ],
    }
  }).catch(async ($, e, next) => {
    // fail closed: a check that broke never lets an unscanned call or result through
    if (!next.called) {
      $.ui.log(`[sdlc-guard] check failed (${next.error.kind}); denied ${e.tool}`)
      return { deny: `sdlc-guard could not check this ${e.tool} call (${next.error.kind}), so it was not run.` }
    }
    try {
      await next(e)
    } catch {
      return { deny: `The ${e.tool} call failed; sdlc-guard withheld its error unscanned.` }
    }
    return { deny: `sdlc-guard could not scan the ${e.tool} output (${next.error.kind}), so it was withheld. The tool did run.` }
  })
}
