import { expect, test } from 'claude-code/testing'

import { MAIN, clearFinished, completed, counts, createTree, fit, fmtDuration, rows, spawned, stepped, toolLabel, toolRan, trimmed } from './flow.ts'

const spawn = (id: string, parent?: string) => ({
  agentId: id, parentAgentId: parent, description: `job ${id}`, subagentType: 'Explore', prompt: 'look', fork: false, background: false,
})

test('subagents nest under the loop that spawned them', () => {
  const t = createTree()
  spawned(t, spawn('a'), 1)
  spawned(t, spawn('b', 'a'), 2)
  spawned(t, spawn('c'), 3)
  expect(rows(t).map(r => `${r.depth}:${r.node.id}`)).toEqual([`0:${MAIN}`, '1:a', '2:b', '1:c'])
})

test('steps, tools and completion are recorded per loop', () => {
  const t = createTree()
  spawned(t, spawn('a'), 0)
  stepped(t, 'a', { input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 })
  toolRan(t, 'a', 'Read x.ts')
  completed(t, 'a', { answer: 'done', durationMs: 5000 }, 9)
  const n = t.nodes.get('a')!
  expect([n.steps, n.contextTokens, n.toolCount, n.status, n.answer]).toEqual([1, 100, 1, 'done', 'done'])
  expect(counts(t)).toEqual({ running: 0, done: 1, failed: 0, aborted: 0 })
})

test('finished agents are trimmed oldest first and a running one is kept', () => {
  const t = createTree()
  for (const id of ['a', 'b', 'c']) spawned(t, spawn(id), 0)
  completed(t, 'a', {}, 1)
  completed(t, 'b', {}, 1)
  trimmed(t, 2)
  expect(t.order).toEqual([MAIN, 'b', 'c'])
  clearFinished(t)
  expect(t.order).toEqual([MAIN, 'c'])
})

test('formatting', () => {
  expect(fit('a  b\nc', 10)).toBe('a b c')
  expect(fit('abcdefghij', 5)).toBe('abcd…')
  expect(fmtDuration(65_000)).toBe('1m05s')
  expect(toolLabel('Bash', { command: 'ls' })).toBe('Bash ls')
})
