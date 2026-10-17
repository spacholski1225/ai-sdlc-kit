// The agent tree as plain data: the main loop, the subagents it spawned and
// what crossed between them. No engine calls, so the tests drive it directly.

export const MAIN = 'main'

export type Status = 'running' | 'done' | 'failed' | 'aborted'

export type Node = {
  id: string
  /** the loop that spawned it; undefined on main */
  parentId?: string
  type: string
  description: string
  model?: string
  status: Status
  fork: boolean
  background: boolean
  /** context handed down */
  prompt: string
  /** context handed back up */
  answer?: string
  /** input tokens of its latest request: how full its window is now */
  contextTokens: number
  steps: number
  toolCount: number
  /** the most recent tool calls, newest last */
  tools: string[]
  startedAt: number
  durationMs?: number
}

export type Tree = { nodes: Map<string, Node>; order: string[] }

export const KEEP_TOOLS = 6

export function createTree(now = 0): Tree {
  const main: Node = {
    id: MAIN, type: 'main', description: 'main loop', status: 'done', fork: false, background: false,
    prompt: '', contextTokens: 0, steps: 0, toolCount: 0, tools: [], startedAt: now,
  }
  return { nodes: new Map([[MAIN, main]]), order: [MAIN] }
}

export const loopId = (agentId: string | undefined) => agentId ?? MAIN

export type Spawn = {
  agentId: string
  parentAgentId?: string
  description: string
  subagentType: string
  prompt: string
  fork: boolean
  background: boolean
  model?: string
}

export function spawned(tree: Tree, s: Spawn, now: number): Node {
  const node: Node = {
    id: s.agentId,
    parentId: s.parentAgentId && tree.nodes.has(s.parentAgentId) ? s.parentAgentId : MAIN,
    type: s.subagentType,
    description: s.description,
    model: s.model,
    status: 'running',
    fork: s.fork,
    background: s.background,
    prompt: s.prompt,
    contextTokens: 0, steps: 0, toolCount: 0, tools: [],
    startedAt: now,
  }
  if (!tree.nodes.has(node.id)) tree.order.push(node.id)
  tree.nodes.set(node.id, node)
  return node
}

export function mainStarted(tree: Tree, text: string, now: number): void {
  const main = tree.nodes.get(MAIN)!
  main.status = 'running'
  main.startedAt = now
  main.durationMs = undefined
  if (text) main.prompt = text
}

type Usage = { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export function stepped(tree: Tree, agentId: string | undefined, usage: Usage | null | undefined): void {
  const n = tree.nodes.get(loopId(agentId))
  if (!n || !usage) return
  n.steps += 1
  n.contextTokens = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
}

export function toolRan(tree: Tree, agentId: string | undefined, label: string): void {
  const n = tree.nodes.get(loopId(agentId))
  if (!n) return
  n.toolCount += 1
  n.tools = [...n.tools, label].slice(-KEEP_TOOLS)
}

export function completed(
  tree: Tree,
  agentId: string | undefined,
  r: { answer?: string; reason?: string; durationMs?: number },
  now: number,
): void {
  const n = tree.nodes.get(loopId(agentId))
  if (!n) return
  n.status = r.reason === 'aborted' ? 'aborted' : r.reason === 'error' ? 'failed' : 'done'
  n.answer = r.answer
  n.durationMs = r.durationMs ?? now - n.startedAt
}

/** Forgets finished subagents, oldest first, beyond `max`. */
export function trimmed(tree: Tree, max: number): void {
  const finished = tree.order.filter(id => id !== MAIN && tree.nodes.get(id)?.status !== 'running')
  let over = tree.order.length - 1 - max
  for (const id of finished) {
    if (over <= 0) break
    tree.nodes.delete(id)
    tree.order = tree.order.filter(x => x !== id)
    over -= 1
  }
}

export function clearFinished(tree: Tree): void {
  for (const id of [...tree.order]) {
    if (id !== MAIN && tree.nodes.get(id)?.status !== 'running') {
      tree.nodes.delete(id)
      tree.order = tree.order.filter(x => x !== id)
    }
  }
}

export function counts(tree: Tree): Record<Status, number> {
  const c: Record<Status, number> = { running: 0, done: 0, failed: 0, aborted: 0 }
  for (const id of tree.order) if (id !== MAIN) c[tree.nodes.get(id)!.status] += 1
  return c
}

/** Rows in tree order (children under their parent) with their depth. */
export function rows(tree: Tree): { node: Node; depth: number }[] {
  const out: { node: Node; depth: number }[] = []
  const walk = (id: string, depth: number) => {
    const node = tree.nodes.get(id)
    if (!node) return
    out.push({ node, depth })
    for (const other of tree.order) if (tree.nodes.get(other)?.parentId === id) walk(other, depth + 1)
  }
  walk(MAIN, 0)
  return out
}

// -- formatting --------------------------------------------------------------

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

export function fit(text: string, width: number): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  const w = Math.max(1, Math.floor(width))
  return chars.length <= w ? chars.join('') : chars.slice(0, w - 1).join('') + '…'
}

export function toolLabel(tool: string, input: Record<string, unknown>): string {
  const pick = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  const arg = pick('command') ?? pick('file_path') ?? pick('pattern') ?? pick('path') ?? pick('description') ?? ''
  return arg ? `${tool} ${arg}` : tool
}

export function paneColumns(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 52
  return Math.min(120, Math.max(30, n))
}

export function maxAgents(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 60
  return Math.min(500, Math.max(5, n))
}
