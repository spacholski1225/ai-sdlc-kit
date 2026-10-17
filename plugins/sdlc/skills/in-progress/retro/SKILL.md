---
name: retro
description: Look back at finished work (a session, or the whole explore-to-PR flow of a feature) and propose improvements to the agent's environment: navigation pointers, automated checks, reviewer standards, slimmer steering files, tool economy, information access. Proposals only; nothing is changed until the user picks. Use after work that was harder than it should have been.
disable-model-invocation: true
---

# Retro

The user asked for a **retrospective**. You propose improvements to the coding agent's **environment** so future runs go better. You change the environment, not the code, and only after the user picks a candidate.

Load `writing-for-agents` first: it is the style guide for every steering file, standards file or skill you propose to touch.

## Principles

- **Every candidate traces to a moment.** It cites a specific event in the record: a search that took twenty tool calls, a mistake a tool could have caught, a question a coder had to ask, a finding the reviewers raised. A candidate you cannot trace to a moment is generic advice; drop it. A smooth run has little to teach, and "nothing to improve" is a valid result.
- **Propose, do not apply.** Edit nothing and install no hook, lint rule or CI job until the user picks a candidate and agrees to the change.
- **Nothing secret in the output.** Session logs can hold keys, tokens and customer data. Quote none of it; describe the moment in words.
- **Show the user the reasoning, not the log.** Quote at most a line or two when a candidate needs it.

## Process

### 1. Choose what to read

Default to the current session. Otherwise the user names it: a session, a feature, or a time span.

The record has several sources; use those that exist and say which you read:

- **The session itself.** The current conversation, or session logs on this machine (for Claude Code, `~/.claude/projects/<project-dir>/*.jsonl`, one file per session). Logs are large: search them (by tool name, error text, repeated reads of the same file) and read only the stretches around hits. Never load a whole log.
- **The spec and tickets** of the feature (`docs/specs/`): the `Decision:` lines, questions the user had to answer, tickets that needed rework.
- **The `review-branch` triage**, when it ran in the session: what the reviewers found, what was fixed, what the user was asked. Every fix is a candidate for a check that would have caught it earlier.
- **The coders' reports**: blocked tickets, questions, failed attempts.

If the work spans several sessions, ask the user which ones to read rather than guessing.

### 2. Find moments

Read for where the agent struggled, wasted effort, was corrected, or lacked something. Collect the moments first, with no categories in mind, so the categories do not push you to invent.

### 3. Sort into categories

Map each moment to the category that fits it; a moment can fit none, and that is fine.

- **Navigation**: how easy was it to find the right files? Are there hidden dependencies between files? Would a **navigation pointer** help? _Use when_ finding a piece of information took long.
- **Automated checks**: could an automated check (lint, types, tests, filesystem lint) have caught the agent's error? Read the repo's own check commands first (package scripts, build-tool lint and check targets, CI workflow), so the finding can be a check that already exists but is unwired or silently broken, not a reinvention. A repo with no **guardrail** at all (no pre-commit hook and no CI job running lint, typecheck or tests) is a finding in itself. _Use when_ the agent made a mistake a check could catch, or there is no guardrail.
- **Coding standards**: should a reviewer be given a new rule, or an existing rule removed or clarified? Classify the violation first. A **mechanical** one (a fixed syntactic pattern, a banned API, an import shape, a file-location rule) gets a deterministic check: a custom rule in the repo's own linter, a pre-commit hook, or a CI job, whichever is cheapest for the repo. Build the check rather than write the rule. Prose in the repo's documented standards file is for **judgement calls** only (cross-file consistency, "matches the surrounding style"). _Use when_ a reviewer missed a mistake or `review-branch` repeatedly found the same kind of problem.
- **Steering files** (CLAUDE.md, AGENTS.md, in the repo or in the user's global scope): is there steering that belongs in the standards or in a check instead? _Use when_ the file is large.
- **Tool economy**: did the agent make expensive tool calls that could be streamlined? Is some custom tool (CLI, MCP) token-inefficient? _Use when_ a call was costly for what it returned.
- **No-ops**: instructions in steering files that do not change the agent's behaviour. _Use when_ steering files are large and unwieldy.
- **Information access**: could the agent be given more access? Dev-server logs teed to a file, read-only access to a third-party service. _Use when_ a crucial piece of information was out of reach.

### 4. Present

Show the candidates in chat, most severe first. For each: the category, the moment it traces to, the proposed change and where it would land (which file, which check), and what it would prevent. Severity is by cost: a quiet mistake that shipped outranks a loud, cheap one.

Then stop and wait. The user picks the candidates to pursue, and you make only those changes, with the user's confirmation of each. Do not commit; the user decides when.

## Reference

### Implementation versus review

Work goes through two stages. The implementation agent has the most **context pressure**: it explores, writes code and debugs. The reviewer receives a diff, so it needs no exploration and has room to apply standards. A new standard therefore belongs where the reviewer reads it, not in the implementer's always-loaded steering.

### Where things live

- `CLAUDE.md` / `AGENTS.md` load into every agent's context in the repo. Use them very sparingly, mostly for **navigation pointers** to other files.
- The repo's documented standards file (`CODING_STANDARDS.md` or whatever the repo uses) is read during review, not implementation. If none exists and a judgement-call rule needs a home, propose creating one and let the user decide. When it grows past about 1,000 lines, add navigation pointers to docs folders.
- Docs are reference files reached through pointers. Look for an existing doc before proposing a new one.
- Skills are for docs whose description should sit in the agent's context, or for user-invoked commands.

### Limits to keep in mind

- You see the record you were given. You cannot tell that a check proposed last month now fires too often or that the bug behind it is gone; flag a rule for removal only when the record shows it getting in the way.
- At the end of a long task the struggles from the middle of the run are the easiest to forget. Go back to the record; do not rely on recall.
