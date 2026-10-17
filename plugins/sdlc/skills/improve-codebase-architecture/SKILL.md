---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities (shallow modules that could become deep ones), and present them as a visual HTML report for the user to read and decide on. Discovery only: no interfaces, no spec, no plan, no code changes. Use periodically for upkeep, or when the user wants to know what in the architecture could be improved and where. Not for a specific change that is already chosen (grill-me) and not for reviewing a branch (review-branch).
disable-model-invocation: true
---

# Improve Codebase Architecture

Find architectural friction and show where **deepening opportunities** are: refactors that turn shallow modules into deep ones. The aim is testability and easier navigation for people and agents.

The result is a **proposal to read**, not a plan. You say what is wrong, where, and roughly what would change and why it pays off. You do not design interfaces, write a spec, or break the work into steps. The user reads the report and decides what, if anything, to do. Change no code. The only thing you write is the report file (step 4), left uncommitted for the user and the team to look at.

Use the vocabulary in [VOCABULARY.md](./VOCABULARY.md) exactly in every finding: **module**, **interface**, **implementation**, **depth**, **seam**, **adapter**, **leverage**, **locality**. Do not drift into "component", "service", "API" or "boundary".

## Principles

- **Evidence over volume.** Every candidate names real files and the friction you actually saw. If the code is fine, say so; an empty or mostly weak report is a valid and useful result. Do not invent candidates to fill the report.
- **Weight recent change.** Deepening pays off where code keeps changing, so hot spots come first.
- **Domain language for domain things.** Name modules with the terms from `DOMAIN.md` when it exists ("the Order intake module", not "the FooBarHandler").
- **No decisions for the user.** Strength labels are your assessment, not a ruling. When a call depends on knowledge you do not have (a constraint, a plan, a reason the code looks this way), say so in the card instead of guessing.

## Process

### 1. Scope

Decide where to look before you look.

- If the user named a direction (a module, a subsystem, a pain point), take it.
- Otherwise walk back a good stretch of `git log --oneline --name-only` to find hot spots: files and areas that keep coming up. Let those pull your attention first. If changes are scattered with no clear hot spot, widen the net.

Read `DOMAIN.md` (the root map, then only the contexts the scope touches) and `OPEN-QUESTIONS.md` if they exist. Read any documented architecture or standards the repo has (CLAUDE.md, CONTRIBUTING, docs) for the area. Decisions written there are not re-litigated: if a candidate would contradict one, mention it only when the friction is real enough to warrant reopening, and say so in the card.

State the scope in one line to the user (the direction taken, or the hot spots found) before scanning.

### 2. Scan

Start sub-agents (`Explore`) to walk the scoped code, in parallel when the scope has clearly separate areas, at most 3. Give each the scope, the paths of `DOMAIN.md` and the standards, the contents of [VOCABULARY.md](./VOCABULARY.md) (as a path to read), and this list. Tell them to explore organically, not to run a checklist, and to return compact findings with file paths, never raw code. Friction to look for:

- understanding one concept requires bouncing between many small modules;
- **shallow** modules: an interface nearly as complex as the implementation;
- pure functions extracted only for testability while the real bugs hide in how they are called (no **locality**);
- tightly coupled modules leaking across their seams;
- parts that are untested or hard to test through their current interface.

Apply the **deletion test** to every suspected shallow module: would deleting it concentrate complexity, or only move it? "Concentrates" is the signal. A module that fails the signal is not a candidate.

Verify what the sub-agents bring back: open the files behind every candidate you keep. Drop what you cannot confirm in the code.

### 3. Group and grade

Merge related findings into candidates. A candidate is one deepening, covering one cluster of modules. For each, classify the dependencies of the cluster by category (see [VOCABULARY.md](./VOCABULARY.md)); the category says how the deepened module would be tested.

Give each candidate a strength:

- `Strong`: clear friction seen in code that changes often, and the deletion test says the complexity concentrates.
- `Worth exploring`: real friction, but the payoff or the right shape depends on something you could not settle.
- `Speculative`: plausible, thin evidence.

If every candidate is `Speculative`, or you found none, say plainly that the architecture looks fine in this scope.

### 4. Report

Write a self-contained HTML file to `docs/architecture-reviews/architecture-review-<timestamp>.html` in the repo (create the directory if needed), so every run gets a fresh file the user and the team can open. The file is **never committed**: do not stage it and do not touch `.gitignore`. It stays untracked until the user decides what to do with it. Open it for the user (`open` on macOS, `xdg-open` on Linux, `start` on Windows) and give the absolute path.

The scaffold, card contents, diagram patterns and tone are in [REPORT.md](./REPORT.md). Every candidate gets a before/after visual.

Do not propose interfaces, method signatures or a sequence of steps. Describe the change in plain English and what it would buy.

### 5. Close

After the file is written, give the user a short summary in chat: the scope, the number of candidates by strength, and your top recommendation in one line. Then stop. Do not start any of the work and do not ask the user to pick right now; they read the report and come back when they have decided.

Tell the user that a candidate they want to pursue goes through `grill-me` (direction chosen, needs sharpening) or `explore` (they want to see options first), and then on to `write-spec`. Mention that working through several candidates in one conversation fills the context with the report and the discussion, so it is better to take one at a time in a fresh conversation, carrying the candidate's description rather than the file.

Say that the report is saved in the repo and not committed; committing it, sharing it with the team, or deleting it is the user's call. Nothing from this run is written to `DOMAIN.md`, `OPEN-QUESTIONS.md` or anywhere else.
