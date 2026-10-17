// The pure half of sdlc-guard: what a Bash command may not do, and which
// strings are secrets. No engine calls, so the tests drive it directly.

export type Rule = { pattern: RegExp; reason: string }

/** A list option: a string[] or a comma-separated string; empty means unset. */
export function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v !== '')
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

/** The command with every quoted string emptied, so a flag inside a message is not read as a flag. */
export function unquoted(command: string): string {
  return command.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'[^']*'/g, "''")
}

// -- destructive commands ----------------------------------------------------

export const DESTRUCTIVE: readonly Rule[] = [
  {
    // arguments are read up to the end of this command only: not past ; & |
    pattern: /\brm\s+(?=(?:[^\s;&|]+\s+)*?(?:-[a-z]*r[a-z]*|--recursive)\b)(?:[^\s;&|]+\s+)*?["']?(?:\/|~|\$HOME|\$\{HOME\}|\.\.?)["']?(?:\/\.?)?["']?(?:\s|$|;|&|\|)/i,
    reason: 'recursive delete of a root, home or working directory',
  },
  { pattern: /\brm\s+.*--no-preserve-root\b/i, reason: 'rm with --no-preserve-root' },
  { pattern: /\bgit\s+push\b(?!.*--force-with-lease).*(--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b)/, reason: 'force push (use --force-with-lease)' },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+(?:-[a-zA-Z]*f|.*--force\b))/, reason: 'history or working-tree destruction' },
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, reason: 'destructive SQL' },
  { pattern: /\bmkfs(\.|\s)/, reason: 'filesystem format' },
  { pattern: /\bdd\s+.*\bof=["']?\/dev\//, reason: 'raw disk write' },
  { pattern: /\bchmod\s+(-R\s+)?777\b/, reason: 'world-writable permissions' },
]

// -- commit hygiene ----------------------------------------------------------

/** Paths that stay on this machine; staging one is refused. */
export const LOCAL_FILES: readonly RegExp[] = [
  /(^|\/)\.env(\.[^\s/]*)?$/,
  /(^|\/)docker-compose\.override\.ya?ml$/,
  /(^|\/)[^\s/]*\.local(\.[^\s/]*)?$/,
]

export type HygieneOptions = { coAuthor: boolean; blanketStaging: boolean; localFiles: boolean; extraLocal: RegExp[] }

/** The reason a git command breaks the commit rules, if it does. */
export function gitViolation(command: string, o: HygieneOptions): string | undefined {
  const bare = unquoted(command)
  if (o.coAuthor && /\bgit\b[^|;&]*\bcommit\b/.test(bare) && /co-authored-by\s*:/i.test(command)) {
    return 'a commit message with a Co-Authored-By trailer (leave it out)'
  }
  if (o.blanketStaging) {
    if (/\bgit\s+add\s+(?:-[A-Za-z-]+\s+)*(?:-A|--all|\.|\*)(?=\s|$|;|&|\|)/.test(bare)) {
      return 'git add of everything (stage the changed files by explicit path)'
    }
    if (/\bgit\s+commit\b[^|;&]*\s(?:-[a-zA-Z]*a[a-zA-Z]*|--all)(?=\s|$)/.test(bare)) {
      return 'git commit -a (stage the changed files by explicit path first)'
    }
  }
  if (o.localFiles) {
    const add = /\bgit\s+add\s+([^|;&]*)/.exec(bare)
    if (add) {
      const paths = (add[1] ?? '').split(/\s+/).filter(p => p && !p.startsWith('-'))
      const hit = paths.find(p => [...LOCAL_FILES, ...o.extraLocal].some(re => re.test(p)))
      if (hit) return `staging ${hit}, a file that stays local`
    }
  }
  return undefined
}

// -- secrets -----------------------------------------------------------------

export type Pattern = { name: string; re: RegExp }

export const SECRETS: readonly Pattern[] = [
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'anthropic-api-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'openai-api-key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'github-token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'stripe-key', re: /\b[sr]k_(live|test)_[0-9A-Za-z]{24,}\b/g },
  { name: 'slack-token', re: /\bxox[abpr]-[0-9A-Za-z-]{10,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'connection-string', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@/gi },
]

export function redactString(input: string, patterns: readonly Pattern[], hits: Set<string>): string {
  let out = input
  for (const { name, re } of patterns) {
    out = out.replace(re, () => {
      hits.add(name)
      return `[REDACTED:${name}]`
    })
  }
  return out
}

/** Walks any JSON-ish value and redacts every string inside it. */
export function redactDeep<T>(value: T, patterns: readonly Pattern[], hits: Set<string>): T {
  if (typeof value === 'string') return redactString(value, patterns, hits) as T
  if (Array.isArray(value)) return value.map(v => redactDeep(v, patterns, hits)) as T
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) copy[k] = redactDeep(v, patterns, hits)
    return copy as T
  }
  return value
}
