---
name: review-branch
description: Review a finished feature branch for code quality before it goes to a PR, with four parallel reviewers (design, tests, compatibility, spec), then fix what matters through coder sub-agents and re-review until the reviewers accept or two rounds have passed. Use after the user has tested the result of implement, or when the user asks to review a branch. Does not check that the code works (that is done) and does not push or open a PR.
---

# Review Branch

Raise the quality of a branch that already works. You are the **supervisor** again: you have the spec and the history of the work. Four read-only **reviewers** inspect the diff, you verify and decide what to fix, **coders** fix it, the **merger** merges the fixes back onto the branch, and the reviewers confirm. The result is a branch with clean, well-tested code that does not break more than it must.

Run this skill on the most capable model (Opus). The reviewers, coders and the merger are the agents `sdlc:design-reviewer`, `sdlc:test-reviewer`, `sdlc:compat-reviewer`, `sdlc:spec-reviewer`, `sdlc:coder` and `sdlc:merger`.

## What is reviewed

The diff of the branch against the merge-base with main, plus the architecture around the changed code. Whether the code works is settled: the user has tested it. The reviewers look at quality only. Where existing code is weak, good practice wins over copying it; where the repo documents a standard (CLAUDE.md, CONTRIBUTING, coding standards, lint config), the documented standard wins.

| Reviewer | Looks at |
|----------|----------|
| `design-reviewer` | module depth (small interface, much behaviour behind it), seams, coupling, code smells, names, documented standards |
| `test-reviewer` | coverage of core behaviour, tests that would pass with broken code, tests at the wrong seam |
| `compat-reviewer` | how much the change breaks: public interfaces, contracts, schemas, config, behaviour existing callers rely on |
| `spec-reviewer` | the diff against the current spec: missing, partial, wrong, and out-of-scope behaviour |

## Rules

- **You decide what to fix, within limits.** Fix on your own what is clearly a quality problem and changes no behaviour. **Ask the user** when a fix breaks a contract, changes behaviour, changes architecture materially, concerns a mismatch with the spec, or when you are not sure. Never guess.
- **Reviewers are read-only** on the review checkout. They do not edit, stage, commit, or move HEAD.
- **Verify before you act.** A reviewer can be wrong. Read the code behind every finding you act on or ask the user about.
- **Nothing reaches main.** Fixes are merged onto the branch under review. Nothing is pushed and no PR is opened unless the user asks.
- **Commits** follow the same rules as in `implement`: no Co-Authored-By line, explicit paths only, never untracked local files.
- **At most 2 fix rounds.** The loop does not run on indefinitely.
- **Test output is long.** Redirect it to a file and read the tail.

## Process

### 1. Start

1. Check the branch: tracked files have no uncommitted changes (untracked files are fine and are never touched). If they do, tell the user and stop.
2. Pin the base: `git merge-base main HEAD` (ask for the base if the main branch has another name). Capture the diff command `git diff <base>...HEAD` and `git log <base>..HEAD --oneline`. Stop if the diff is empty.
3. Collect what the reviewers need, as paths, not contents:
   - the spec file and the tickets file (they are probably untracked, so they live only in the main checkout; reviewers read them by path),
   - the `Decision:` lines recorded in the tickets and anything the user changed in the spec during the work (you know this; list it),
   - `DOMAIN.md` if it exists,
   - the documented standards files you can find.
   If there is no spec, skip `spec-reviewer` and say so in the report.

### 2. Review (round 0)

Start the four reviewers together, in the foreground, each with the diff command, the commit list and the paths above. Their briefs live in the agent files; add nothing to them.

### 3. Triage

Merge the four reports. Remove duplicates, verify in the code, and grade each finding by what it does to a person using or maintaining the software, not by the reviewer's label. Put each one in exactly one group:

- **Fix**: a clear quality problem with no change of behaviour or contract.
- **Ask**: breaks a contract, changes behaviour, changes architecture materially, disagrees with the spec, or you are unsure.
- **Drop**: wrong, already enforced by tooling, or not worth a change. Keep a one-line reason.

Show the user a short numbered summary: the **Ask** items with your recommendation each, and the counts of Fix and Drop. Do not list every Fix item unless the user asks. Wait for answers on the **Ask** items; an answer turns an item into Fix or Drop.

A spec that disagrees with the code is always an **Ask**: the user says whether the spec is out of date or the code is wrong.

### 4. Fix and confirm (up to 2 rounds)

1. Group the Fix items by the files they touch and write each group as a small ticket for a coder: the files, exactly what to change and why, the tests that must stay green or be added, and `Done when` (the touched tests and the full suite pass). Start the coders as in `implement` (the fix id `F<n>` takes the place of `T<n>`; branch `wt/<slug>/F<n>`), at most 3 at once, in parallel only when the groups touch different files. Answer their questions from the spec; ask the user when you are not sure.
2. Merge each finished group with the merger, one at a time, onto the branch under review. The merger runs the touched tests and the full suite.
3. Ask for acceptance. Run again only the reviewers of the axes the fixes touched, giving them the diff of the fixes only (from the tip before the round to the new tip). A reviewer accepts or returns findings.
4. If all accept, you are done. If findings remain, triage them again (step 3) and start round 2.

After round 2, stop. List what is still open (findings that were not accepted, with your view of each) and wait for the user's decision. Do not start a third round on your own.

### 5. Finish

On the branch, run the full test suite, typecheck and build with the repo's own commands. Report to the user:

- what was fixed, by group and in a line each;
- what was dropped, with reasons;
- what was asked and how the user answered;
- what is still open;
- how much the change breaks, in the compat-reviewer's words.

Say that the branch is ready for a PR. Offer to push it and open one only when the user asks. Remove any worktrees that remain.
