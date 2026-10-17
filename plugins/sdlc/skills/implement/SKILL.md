---
name: implement
description: Implement a written spec by running its tickets (docs/specs/todo_<slug>.md) with parallel coder sub-agents in separate worktrees, merging them onto one feature branch and leaving working code for the user to test. Use after write-tickets, or when the user points at a tickets file and wants it built. Does not review code (that is review-branch) and does not push or open a PR.
---

# Implement

Turn a tickets file into working code on one branch. You are the **supervisor**: you hand tickets to **coder** sub-agents, answer their questions strictly from the spec, run the **merger**, and ask the user whenever the spec does not settle something. The goal is working code the user can test, not polished code: refactoring and review come later.

Run this skill on the most capable model (Opus). Coders run on Sonnet and the merger on Opus; both are set in their agent files (`sdlc:coder`, `sdlc:merger`).

## Roles

| Role | Who | Does |
|------|-----|------|
| supervisor | you, the main session | reads the spec and tickets, picks tickets, starts coders (at most 3 at once), answers them, starts the merger, keeps ticket statuses, runs the final checks |
| coder | `sdlc:coder`, one per ticket | builds one ticket in its own worktree, commits, reports |
| merger | `sdlc:merger`, one at a time | merges a finished ticket branch into the integration branch, fixes conflicts, runs tests |

Other terms: **integration branch** is the one branch that holds all the work and later becomes the PR to main. **Ticket branch** is `wt/<slug>/T<n>`, the coder's branch. **Frontier** is the tickets that are `not started` and whose blockers are all `merged`.

## Rules

- **You do not guess.** You answer a coder only when the spec or the ticket states the answer. Anything else, and anything that would change a ticket's description or contradict the spec, goes to the user. Set the ticket to `blocked: <reason>`, ask, and wait. Other coders keep working.
- **A coder may do a ticket differently from how it is written only with your permission**, and only where the spec stays true. Write the permitted change into the ticket as `Decision:` with its reason, so the user sees it in the final report.
- **Spec and tickets are not committed** unless the user says so. Their content reaches coders through you, in the prompt.
- **Commits** are made without a Co-Authored-By line and contain only the files the work changed or added (explicit paths, never `git add -A` or `.`). The user's repos hold untracked `.env`, docker and helper files that must not reach the repo.
- **Nothing is pushed**, no PR is opened, and nothing is merged into main.
- **Keep sub-agent context small.** Send the ticket text and the global constraints, not the whole spec. Send a spec excerpt only when a coder asks.
- **Test output is long.** Redirect it to a file and read the tail.

## Process

### 1. Start

1. Take the tickets path from the user, or the file just written in this conversation. If there is none, list `docs/specs/` and ask. Read the tickets and the spec they name (`Spec:` line). Read the relevant parts of `DOMAIN.md` if it exists.
2. Check the git state: tracked files have no uncommitted changes (untracked files are fine and are never touched). If tracked files are modified, tell the user and stop.
3. Find the integration branch. If the current branch is not main, use it. If it is main, propose `feat/<slug>` and ask for the name, then create it. A branch named `feat/<slug>` rules out `feat/<slug>/T1`, which is why ticket branches use `wt/`.
4. Resume if statuses already exist: reconcile them with `git branch --list 'wt/<slug>/*'` and the log. A `coded` ticket whose branch is not merged goes back to the merge queue. An `in progress` ticket with no running coder goes back to `not started` (its worktree is removed first).

### 2. Run the tickets

Keep a status for every ticket in the tickets file itself (the `Status` line and its checkbox): `not started`, `in progress`, `blocked: <reason>`, `coded`, `merged`. Only you edit it, in the main checkout, uncommitted.

Repeat until every ticket is `merged`:

1. Compute the frontier. Start coders for it, up to 3 running at once. For each: call the Agent tool with `sdlc:coder`, in the background, with worktree isolation. The prompt holds the ticket text verbatim, the Global constraints, the slug and ticket number (for the branch name `wt/<slug>/T<n>`), and the integration branch name. Set the ticket to `in progress`.
2. Handle coder reports as they arrive (formats in `agents/coder.md`):
   - **DONE**: set the ticket to `coded` and queue it for the merger.
   - **QUESTION** or **BLOCKED**: decide by the rules above. If you can answer from the spec or ticket, resume the same coder with SendMessage and the answer. If you are unsure, or the answer would change the ticket description, set the ticket to `blocked: <reason>`, ask the user, and resume the coder with the user's decision (or stop it, if the ticket changes).
   - A coder that cannot run a test because something local is missing (an `.env`, a running service) reports it as a QUESTION. Ask the user to either provide it or accept work without that test. Never copy untracked files into a worktree on your own.
3. Merge one ticket at a time. Start `sdlc:merger` with the ticket branch, the integration branch and the ticket's `Done when`. The merger:
   - merges the ticket branch into the integration branch from the main checkout,
   - resolves conflicts that follow from the code alone and asks you about anything where the intended behaviour is unclear (you answer from the spec or ask the user),
   - runs the ticket's tests and the full suite.
   If the suite fails because of the merge, the merger fixes it. If it fails because the ticket's logic is wrong, resume that ticket's coder with the failure. When the merge is clean: set the ticket to `merged`, remove its worktree and delete its ticket branch, and recompute the frontier.
4. If nothing is running, nothing is in the frontier and tickets remain, all of them are `blocked` or wait on a blocked ticket. Show the user the blocked tickets with their questions.

Tell the user briefly when a ticket changes state ("T3 merged, T4 and T5 started"). Do not narrate more than that.

### 3. Finish

When every ticket is `merged`, on the integration branch:

1. Run the full test suite, typecheck and build with the repo's own commands. If something fails, send it to one coder and then the merger; do not fix it yourself.
2. Check the spec's required behaviours: each one must have a passing test. List any that do not.
3. Report to the user: the branch name, the tickets and their order, every `Decision:` made during the run (permitted changes and answers to coders), anything not tested, and how to try the result by hand.
4. Ask the user to test. Say that `review-branch` is the next step once they are satisfied, and offer to push the branch and open a PR only when they ask. Remove any worktrees that remain.
