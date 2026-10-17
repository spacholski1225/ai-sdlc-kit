/**
 * agent-tree: a side pane with the session's agents as they run.
 *
 * The main loop on top, every subagent below it as a tree in spawn order. Select
 * one (click, or Tab and Enter) to see the prompt it was handed, its last tool
 * calls, how full its window got and the answer it handed back.
 *
 *   `/agent-tree` opens it · `/agent-tree clear` forgets finished agents · `/agent-tree stop` closes it
 *
 * It only observes: every hook hands its event on unchanged. The tree is recorded
 * from session start whether the pane is open or not.
 *
 * Options (plugin.json userConfig): columns, maxAgents, openOnStart.
 */
import type { Register } from 'claude-code'

import { MAIN, clearFinished, completed, counts, createTree, fit, fmtDuration, fmtTokens, mainStarted, maxAgents, paneColumns, rows, spawned, stepped, toolLabel, toolRan, trimmed } from './flow.ts'
import type { Status, Tree } from './flow.ts'

const PANE = 'agent-tree'
const COMMAND = 'agent-tree'
const KEY = 'ag:'

const MARK: Record<Status, string> = { running: '◐', done: '●', failed: '✖', aborted: '○' }
const COLOR: Record<Status, string> = { running: 'yellow', done: 'green', failed: 'red', aborted: 'gray' }

let tree: Tree = createTree()
let isOpen = false
let selected: string | undefined

const statusText = (): string | undefined => {
  if (!isOpen) return undefined
  const c = counts(tree)
  return `agents: ${c.running} running · ${c.done} done${c.failed ? ` · ${c.failed} failed` : ''}`
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const keep = maxAgents(options.maxAgents)
  const openOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    tree = createTree(Date.now())
    selected = undefined
    await $.command
      .register({ name: COMMAND, description: 'Live tree of the session’s agents (clear|stop)', argumentHint: '[clear|stop]', immediate: true })
      .catch(err => $.ui.log(`agent-tree: /${COMMAND} not registered: ${err}`))
    if (openOnStart) {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'agents', columns }).catch(err => {
        isOpen = false
        $.ui.log(`agent-tree: pane not opened: ${err}`)
      })
      $.ui.status(statusText())
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      $.ui.status(undefined)
      return { text: 'agent-tree closed' }
    }
    if (arg === 'clear') {
      clearFinished(tree)
      selected = undefined
      if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
      return { text: 'agent-tree: finished agents forgotten' }
    }
    isOpen = true
    await $.ui.open({ id: PANE, title: 'agents', focus: true, columns })
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    const c = counts(tree)
    const hint = e.presentation.isFullscreen ? 'click an agent, or Tab and Enter' : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `${c.running + c.done + c.failed + c.aborted} agents so far · ${hint} · /${COMMAND} stop closes` }
  })

  on('turn.start', async ($, e, next) => {
    mainStarted(tree, e.text, Date.now())
    if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
    return next(e)
  })

  // the context handed down: the Agent call's prompt, known before the subagent runs
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if ('agentId' in r && r.agentId && 'model' in r) {
      spawned(tree, {
        agentId: r.agentId,
        parentAgentId: e.parentAgentId,
        description: e.description,
        subagentType: e.subagentType,
        prompt: e.prompt,
        fork: e.fork === true,
        background: e.background === true,
        model: r.model,
      }, Date.now())
      trimmed(tree, keep)
      if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
    }
    return r
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    stepped(tree, e.agentId, r.usage)
    if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
    return r
  })

  on('tool.call', async ($, e, next) => {
    toolRan(tree, e.agentId, toolLabel(e.tool, e as unknown as Record<string, unknown>))
    if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
    return next(e)
  })

  // the context handed back up: a subagent's final answer
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    completed(tree, e.agentId, { answer: e.answer, reason: e.reason, durationMs: e.durationMs }, Date.now())
    if (isOpen) { $.ui.status(statusText()); $.ui.invalidate('ui.render') }
    return r
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    $.ui.status(undefined)
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    if (e.element.startsWith(KEY)) {
      const id = e.element.slice(KEY.length)
      selected = selected === id ? undefined : id
    }
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(24, e.props.bodyColumns - 1)
    const noop = () => {}
    const list = rows(tree)
    const chosen = selected ? tree.nodes.get(selected) : undefined
    const now = Date.now()

    if (list.length <= 1) return <Text dimColor>no agents yet</Text>

    return (
      <Box flexDirection="column">
        {list.map(({ node, depth }) => {
          const indent = '  '.repeat(depth)
          const ctx = node.contextTokens ? ` ${fmtTokens(node.contextTokens)}` : ''
          const label = node.id === MAIN ? 'main' : `${node.type} ${node.description}`
          return (
            <Box key={`row:${node.id}`} flexDirection="row">
              <Text color={COLOR[node.status]}>{`${indent}${MARK[node.status]} `}</Text>
              <Button key={`${KEY}${node.id}`} plain dimColor={selected !== node.id} label={fit(label, width - indent.length - 2 - ctx.length)} onPress={noop} />
              <Text dimColor>{ctx}</Text>
            </Box>
          )
        })}

        {chosen ? (
          <Box key="detail" flexDirection="column" marginTop={1} paddingLeft={2}>
            <Text dimColor>
              {fit(`${chosen.status} · ${chosen.steps} steps · ${chosen.toolCount} tools · ${fmtDuration(chosen.durationMs ?? now - chosen.startedAt)}${chosen.model ? ` · ${chosen.model}` : ''}`, width - 2)}
            </Text>
            <Text wrap="wrap">{fit(chosen.fork ? '(inherits the parent’s whole context)' : chosen.prompt || '—', 300)}</Text>
            {chosen.tools.map((t, i) => (
              <Text key={`t:${i}`} dimColor wrap="truncate-end">{fit(t, width - 2)}</Text>
            ))}
            {chosen.answer ? <Text color="green" wrap="wrap">{fit(chosen.answer, 400)}</Text> : null}
          </Box>
        ) : null}
      </Box>
    )
  })
}
