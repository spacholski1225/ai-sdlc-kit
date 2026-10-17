import { expect, test } from 'claude-code/testing'

import { branchAction, branchesArgv, countDirty, currentWorktree, fit, parseBranches, parseLog, parseTrack, parseWorktrees, switchArgv, trackLabel } from './git.ts'

const WT = `worktree /r/main
HEAD abc1234
branch refs/heads/main

worktree /r/feature
HEAD def5678
branch refs/heads/feat/x
locked reason

worktree /r/old
HEAD 0000000
detached
prunable gone
`

test('worktrees parse with their flags', () => {
  const list = parseWorktrees(WT)
  expect(list.map(w => w.branch)).toEqual(['main', 'feat/x', undefined])
  expect(list[1]?.locked).toBe(true)
  expect(list[2]?.detached).toBe(true)
  expect(list[2]?.prunable).toBe(true)
})

test('branches parse tracking and worktree', () => {
  const out = 'main\torigin/main\tahead 2, behind 1\t3 days ago\t/r/main\nfeat/x\t\t\t1 day ago\t\nold\torigin/old\tgone\t9 days ago\t\n'
  const list = parseBranches(out)
  expect(list).toHaveLength(3)
  expect(trackLabel(list[0]!)).toBe('↑2 ↓1')
  expect(trackLabel(list[1]!)).toBe('')
  expect(trackLabel(list[2]!)).toBe('gone')
  expect(parseTrack('')).toEqual({ ahead: 0, behind: 0, gone: false })
})

test('actions depend on where a branch is checked out', () => {
  const snap = { root: '/r/main/', worktrees: parseWorktrees(WT), branches: parseBranches('main\t\t\t\t/r/main\nfeat/x\t\t\t\t/r/feature\ntopic\t\t\t\t\n') }
  expect(currentWorktree(snap)?.branch).toBe('main')
  expect(branchAction(snap, snap.branches[0]!).kind).toBe('current')
  expect(branchAction(snap, snap.branches[1]!)).toEqual({ kind: 'open', path: '/r/feature' })
  expect(branchAction(snap, snap.branches[2]!).kind).toBe('switch')
})

test('small helpers', () => {
  expect(countDirty(' M a\n?? b\n')).toBe(2)
  expect(parseLog('abc\tfix: x\t2 days ago\n')[0]).toEqual({ sha: 'abc', subject: 'fix: x', date: '2 days ago' })
  expect(fit('abcdefgh', 4)).toBe('abc…')
  expect(switchArgv('a;b')).toEqual(['git', 'switch', '--no-guess', 'a;b'])
  expect(branchesArgv(0)[3]).toBe('--count=1')
})
