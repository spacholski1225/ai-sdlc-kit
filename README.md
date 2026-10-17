# ai-sdlc-kit

A spec-driven software development workflow for [Claude Code](https://claude.com/claude-code): skills that take a change from a vague problem to a ready pull request, sub-agents that build and review it in parallel, and a few mods that keep the session safe and visible.

It is the way I work with coding agents day to day, written down. Every step leaves something you can read and correct (a spec, a tickets file, a review triage) before the agent moves on, and the agent asks you whenever the written decisions do not settle something. Nothing is pushed and no PR is opened for you.

## The workflow

```
  problem, no solution yet           direction chosen               bug
          │                                │                         │
       explore ──────────────────────►  grill-me                 debugging
                                           │
                                       write-spec      →  docs/specs/<slug>.md
                                           │
                                      write-tickets    →  docs/specs/todo_<slug>.md
                                           │
                                       implement       →  feature branch (you test it)
                                           │
                                     review-branch     →  reviewed branch
                                           │
                                       prepare-pr      →  PR title and description to paste
```

| Step | What happens |
| --- | --- |
| `explore` | You have a problem, not a solution. Claude asks about the problem, scans the code, lays out options with trade-offs and, if you agree, builds a throwaway spike. Ends when you pick a direction. |
| `grill-me` | A relentless interview, in rounds of numbered questions with recommended answers, until you and Claude share the same understanding of the change. |
| `write-spec` | Writes that understanding down: *what* and *why*, no code. Decisions Claude made itself are marked as its call. One check with you: the level at which the change is tested. |
| `write-tickets` | Breaks the spec into ordered tickets, based on the code as it is now, detailed enough for a weaker model or a junior to build one at a time. |
| `implement` | A supervisor hands tickets to parallel `coder` sub-agents in separate git worktrees (test first), a `merger` brings them onto one branch, and you get working code to test. The supervisor answers coders only from the spec and asks you otherwise. |
| `review-branch` | Four read-only reviewers (design, tests, compatibility, spec) inspect the diff in parallel. The supervisor verifies their findings, coders fix what matters, and the reviewers confirm. At most two rounds. |
| `prepare-pr` | Updates the docs and changelog that already exist, checks the branch for sensitive files, proposes a version bump and writes the PR description: summary, evidence, and a one-way or two-way door assessment. |

Supporting skills:

- `init-domain` maps an existing codebase into `DOMAIN.md`: the business language, processes and rules of each bounded context, taken from the code and confirmed with you. The other skills read it, so agents use your project's own terms.
- `debugging` finds the root cause before any fix, protects related behaviour with tests and commits nothing until you confirm.
- `improve-codebase-architecture` scans for shallow modules that could become deep ones and writes an HTML report for you to decide on. Discovery only.
- `wait-what` makes Claude re-explain its last message with the context you were missing.

Skills in `plugins/sdlc/skills/in-progress/` are drafts and are not loaded.

## Install

```
/plugin marketplace add spacholski1225/ai-sdlc-kit
/plugin install sdlc@ai-sdlc-kit
```

From a shell: `claude plugin marketplace add spacholski1225/ai-sdlc-kit`, then `claude plugin install sdlc@ai-sdlc-kit`. In the desktop app, use + next to the prompt, Plugins, Add marketplace, then Add plugin.

Updating: `claude plugin marketplace update ai-sdlc-kit`, then `/reload-plugins`. Each plugin has its own `version`; you get changes once it is bumped.

Requirements: `git` and `jq` (the `sdlc` plugin blocks destructive git commands with a small shell hook). `implement`, `review-branch` and `prepare-pr` are meant to run on Opus; their sub-agents run on Sonnet.

### Status line (optional)

`plugins/sdlc/scripts/context-monitor.py` prints a status line with the model, folder, git branch, session cost, duration and net lines changed. A plugin cannot set the status line itself, so point your `~/.claude/settings.json` at the script in a clone of this repo (needs `python3`):

```json
{
  "statusLine": {
    "type": "command",
    "command": "python3 ~/path/to/ai-sdlc-kit/plugins/sdlc/scripts/context-monitor.py"
  }
}
```

## Mods

A mod is a plugin with a hooks module that changes Claude Code's interface or behaviour. Each one is a separate plugin, so install only the ones you want:

| Mod | What it does | Where it shows |
| --- | --- | --- |
| `sdlc-guard` | Denies destructive Bash commands, redacts secrets from tool results, refuses `Co-Authored-By`, `git add -A` / `commit -a` and staging `.env` / `*.local` files | terminal, desktop, VS Code (no UI) |
| `sdlc-cache` | One quiet line above the prompt: minutes until the prompt cache lapses. `/cache` gives the details | terminal, desktop |
| `sdlc-agents` | Pane with the live tree of subagents. `/agent-tree` | terminal, desktop |
| `sdlc-git` | Pane with worktrees and branches. `/git-panel` | terminal, desktop |

```
/plugin install sdlc-guard@ai-sdlc-kit
/plugin install sdlc-cache@ai-sdlc-kit
/plugin install sdlc-agents@ai-sdlc-kit
/plugin install sdlc-git@ai-sdlc-kit
```

VS Code does not draw mod UI yet, so only `sdlc-guard` and the slash commands apply there. Panes sit above the prompt; `/tui fullscreen` docks them beside the transcript.

Options (guard rules, pane widths, cache lifetime) are `userConfig` fields in each mod's `plugin.json`.

## Development

Work from a local clone: `/plugin marketplace add ~/path/to/ai-sdlc-kit`. Plugins are then read straight from the folder, so an edit plus `/reload-plugins` is enough.

For a mod: `claude --plugin-dir plugins/<mod>`, then `claude plugin validate` and `claude plugin test`.

## Credits and license

Many skills build on [mattpocock/skills](https://github.com/mattpocock/skills) and [obra/superpowers](https://github.com/obra/superpowers). [SOURCES.md](./SOURCES.md) says, skill by skill, what was taken and what changed.

MIT, see [LICENSE](./LICENSE).
