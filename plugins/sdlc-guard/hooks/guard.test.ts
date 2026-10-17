import { describe, expect, test } from 'claude-code/testing'

import { DESTRUCTIVE, SECRETS, gitViolation, redactDeep, unquoted } from './rules.ts'

const ON = { coAuthor: true, blanketStaging: true, localFiles: true, extraLocal: [] }
const denied = (cmd: string) => DESTRUCTIVE.some(r => r.pattern.test(cmd)) || gitViolation(cmd, ON) !== undefined

describe('destructive commands', () => {
  test('are refused', () => {
    for (const cmd of ['rm -rf /', 'rm -rf ~/', 'git push --force origin main', 'git push -f', 'git reset --hard HEAD~1', 'psql -c "DROP TABLE users"']) {
      expect(denied(cmd)).toBe(true)
    }
  })
  test('an rm in one command is not read against the next one', () => {
    expect(denied('rm -r a b && ls && cd ..')).toBe(false)
    expect(denied('rm -r a; cd ~')).toBe(false)
    expect(denied('rm -rf a && rm -rf /')).toBe(true)
  })
  test('ordinary commands pass', () => {
    for (const cmd of ['ls -la', 'rm -rf node_modules', 'git push --force-with-lease', 'git status', 'git log -n 5']) {
      expect(denied(cmd)).toBe(false)
    }
  })
})

describe('commit hygiene', () => {
  test('refuses a co-author trailer', () => {
    expect(gitViolation('git commit -m "x\n\nCo-Authored-By: Someone <a@b.c>"', ON)).toContain('Co-Authored-By')
  })
  test('refuses blanket staging but not explicit paths', () => {
    expect(gitViolation('git add -A', ON)).toBeDefined()
    expect(gitViolation('git add .', ON)).toBeDefined()
    expect(gitViolation('git commit -am "x"', ON)).toBeDefined()
    expect(gitViolation('git add src/a.ts src/b.ts', ON)).toBeUndefined()
    expect(gitViolation('git commit -m "fix: handle -a flag"', ON)).toBeUndefined()
  })
  test('refuses local-only files', () => {
    expect(gitViolation('git add .env', ON)).toContain('.env')
    expect(gitViolation('git add docker-compose.override.yml', ON)).toBeDefined()
    expect(gitViolation('git add config.local.json', ON)).toBeDefined()
    expect(gitViolation('git add docker-compose.yml', ON)).toBeUndefined()
  })
  test('each rule can be switched off', () => {
    expect(gitViolation('git add -A', { ...ON, blanketStaging: false })).toBeUndefined()
  })
})

test('quoted text is not read as flags', () => {
  expect(unquoted('git commit -m "a -a b"')).toBe('git commit -m ""')
})

test('secrets are redacted deep in a result', () => {
  const hits = new Set<string>()
  const out = redactDeep({ text: 'key AKIAABCDEFGHIJKLMNOP and more', list: ['ghp_' + 'a'.repeat(36)] }, SECRETS, hits)
  expect(out.text).toContain('[REDACTED:aws-access-key]')
  expect(out.list[0]).toBe('[REDACTED:github-token]')
  expect([...hits].sort()).toEqual(['aws-access-key', 'github-token'])
})

test('the hook denies a destructive call', async ($, on) => {
  on('tool.call', () => ({ result: 'ran', text: 'ran' }) as never)
  const denied = await $.tool.call({ tool: 'Bash', command: 'git push --force' })
  expect(JSON.stringify(denied)).toContain('Blocked by sdlc-guard')
  const passed = await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(JSON.stringify(passed)).toContain('ran')
})
