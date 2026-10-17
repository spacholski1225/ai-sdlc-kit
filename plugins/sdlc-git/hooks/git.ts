// Pure git plumbing for git-panel: the argv each read runs and the parsers for
// their output. No engine calls, so the tests drive it directly. Git runs by
// argv (no shell), so a branch name is never read as a command.

export type Worktree = {
  path: string
  head: string
  /** short branch name; absent when detached or bare */
  branch?: string
  detached: boolean
  bare: boolean
  locked: boolean
  prunable: boolean
  /** changed paths from `git status --porcelain`; undefined when not read */
  dirty?: number
}

export type Branch = {
  name: string
  upstream?: string
  ahead: number
  behind: number
  /** the upstream was deleted on the remote */
  gone: boolean
  /** committer date, relative ("3 days ago") */
  date: string
  /** absolute path of the worktree that has it checked out, if any */
  worktree?: string
}

export type Commit = { sha: string; subject: string; date: string }

export type Snapshot = { root: string; worktrees: Worktree[]; branches: Branch[] }

export const TOPLEVEL = ['git', 'rev-parse', '--show-toplevel']
export const WORKTREES = ['git', 'worktree', 'list', '--porcelain']
export const STATUS = ['git', 'status', '--porcelain']

export function branchesArgv(max: number): string[] {
  const fields = ['%(refname:short)', '%(upstream:short)', '%(upstream:track,nobracket)', '%(committerdate:relative)', '%(worktreepath)']
  return ['git', 'for-each-ref', '--sort=-committerdate', `--count=${Math.max(1, Math.floor(max))}`, `--format=${fields.join('%09')}`, 'refs/heads']
}

export const logArgv = (branch: string, count = 5): string[] => ['git', 'log', `-n${count}`, '--format=%h%x09%s%x09%cr', `refs/heads/${branch}`, '--']

export const switchArgv = (branch: string): string[] => ['git', 'switch', '--no-guess', branch]

/** Parses `git worktree list --porcelain`: blank-line separated records. */
export function parseWorktrees(out: string): Worktree[] {
  const list: Worktree[] = []
  for (const block of out.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter(Boolean)
    const first = lines[0]
    if (!first?.startsWith('worktree ')) continue
    const wt: Worktree = { path: first.slice('worktree '.length), head: '', detached: false, bare: false, locked: false, prunable: false }
    for (const line of lines.slice(1)) {
      if (line.startsWith('HEAD ')) wt.head = line.slice(5)
      else if (line.startsWith('branch ')) wt.branch = line.slice(7).replace(/^refs\/heads\//, '')
      else if (line === 'detached') wt.detached = true
      else if (line === 'bare') wt.bare = true
      else if (line === 'locked' || line.startsWith('locked ')) wt.locked = true
      else if (line === 'prunable' || line.startsWith('prunable ')) wt.prunable = true
    }
    list.push(wt)
  }
  return list
}

/** Reads `ahead 2, behind 1` / `gone` / `` from %(upstream:track,nobracket). */
export function parseTrack(track: string): { ahead: number; behind: number; gone: boolean } {
  const ahead = /ahead (\d+)/.exec(track)
  const behind = /behind (\d+)/.exec(track)
  return { ahead: ahead ? Number(ahead[1]) : 0, behind: behind ? Number(behind[1]) : 0, gone: track.trim() === 'gone' }
}

export function parseBranches(out: string): Branch[] {
  const list: Branch[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [name, upstream = '', track = '', date = '', worktree = ''] = line.split('\t')
    if (!name) continue
    list.push({ name, upstream: upstream || undefined, ...parseTrack(track), date, worktree: worktree || undefined })
  }
  return list
}

export function parseLog(out: string): Commit[] {
  return out.split('\n').filter(Boolean).map(line => {
    const [sha = '', subject = '', date = ''] = line.split('\t')
    return { sha, subject, date }
  })
}

/** Lines of `git status --porcelain`: how many paths changed. */
export const countDirty = (out: string): number => out.split('\n').filter(line => line.trim() !== '').length

export function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/** Cuts `text` to `width` cells with an ellipsis; never below 1. */
export function fit(text: string, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const chars = Array.from(text)
  return chars.length <= w ? text : chars.slice(0, w - 1).join('') + '…'
}

export function trackLabel(b: Pick<Branch, 'ahead' | 'behind' | 'gone' | 'upstream'>): string {
  if (b.gone) return 'gone'
  if (!b.upstream) return ''
  const parts: string[] = []
  if (b.ahead) parts.push(`↑${b.ahead}`)
  if (b.behind) parts.push(`↓${b.behind}`)
  return parts.join(' ') || '✓'
}

/** Paths compare equal across a trailing slash. */
export function samePath(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return a.replace(/[\\/]+$/, '') === b.replace(/[\\/]+$/, '')
}

export const currentWorktree = (snap: Snapshot): Worktree | undefined => snap.worktrees.find(wt => samePath(wt.path, snap.root))

/** What pressing a branch row can offer next. */
export type BranchAction = { kind: 'current' } | { kind: 'open'; path: string } | { kind: 'switch' }

export function branchAction(snap: Snapshot, branch: Branch): BranchAction {
  if (branch.worktree && samePath(branch.worktree, snap.root)) return { kind: 'current' }
  if (branch.worktree) return { kind: 'open', path: branch.worktree }
  return { kind: 'switch' }
}

export function paneColumns(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 44
  return Math.min(120, Math.max(28, n))
}

export function maxBranches(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 40
  return Math.min(200, Math.max(1, n))
}
