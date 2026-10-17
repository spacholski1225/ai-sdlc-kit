---
name: debugging
description: Find the root cause of a bug and fix it safely, when the expected behaviour is known but the code does not do it. Builds a repeatable failing check first, protects related behaviour with tests, and commits nothing until the user confirms the fix. Use when something is broken, throwing or failing. Not for performance work, and not for new behaviour (use grill-me).
---

# Debugging

Fix a bug by finding its cause, not by guessing. **No fix before the root cause is known.** Fixing a symptom is a failure, even when it is faster.

Fixing a bug changes how existing code behaves. That change must be protected by tests: related behaviour must not break, and the bug must not come back.

## Rules

- **Nothing is committed** until the user confirms the bug is fixed. Leave changes in the working tree.
- **Redact secrets.** Everything you show (commands, outputs, logs, captured artifacts) has secrets replaced with `<REDACTED>`. Keep credentials in environment variables so they never appear in what you show. Quote only the lines of a log that carry the signal. If redacted output is not enough, say so and ask.
- **Finding facts is your job.** Send sub-agents to collect facts (callers of a function, existing tests, git history, long logs) and return compact findings. The loop itself (running, hypotheses, the fix) stays with you.

## Process

### 0. Expected behaviour

You need to know what _should_ happen. If it is clear, move on. If it is unclear, ask the user in rounds in the style of `grill-me`: the whole frontier at once, numbered, each with your recommended answer worded so "yes" accepts it. Ask only about the expected behaviour, never about what the code can tell you.

If nobody knows how it should work, this is not a bug: it is a design question. Suggest `grill-me`.

### 1. Build a feedback loop

**This is the skill.** With a tight pass/fail signal that goes red on _this_ bug, you will find the cause. Without one, reading code will not save you. Spend disproportionate effort here, and do not read code to build a theory before this exists.

Ways to build one, roughly in this order of preference:

1. A failing test at whatever seam reaches the bug.
2. A script against a running dev server (curl, HTTP).
3. A command with a fixture input, diffing the output against a known-good one.
4. A headless browser script that asserts on the DOM, console or network.
5. Replaying a captured request, payload or event log through the code path.
6. A throwaway harness: the minimum part of the system that exercises the bug.
7. A fuzz loop over many random inputs, for "sometimes wrong output".
8. Bisection: automate "check at state X" so `git bisect run` can find the change that introduced it.
9. A differential run: the same input through the old and the new version, or two configs.
10. A script that drives the user through the manual steps and captures the result. Last resort.

Then tighten it: faster (skip unrelated setup), sharper (assert the specific symptom, not "did not crash"), more deterministic (pin time, seed randomness, freeze the network). For a flaky bug the goal is a higher reproduction rate: repeat the trigger many times and narrow the timing until it fails reliably.

Phase 1 is done when you can name **one command that you have already run** and that is:

- **red-capable:** it asserts the user's exact symptom, so it can go red on this bug and green when fixed;
- **deterministic** (or, for a flaky bug, a pinned high reproduction rate);
- **fast:** seconds, not minutes;
- **runnable by you unattended.**

**If you cannot build a loop**, stop and say so. List what you tried and ask the user for (a) access to an environment that reproduces it, (b) a redacted captured artifact (log, HAR, core dump), or (c) permission to add temporary instrumentation. Do not go on to hypotheses.

### 2. Reproduce and minimise

Run the loop and watch it go red. Confirm it shows the failure the **user** described, not a different one nearby, and record the exact symptom.

Then shrink the scenario to the smallest one that still fails: cut inputs, callers, config and steps one at a time, re-running after each cut. Stop when removing anything makes it pass.

### 3. Protect the surroundings

Before changing anything, find out what the fix could affect. Dispatch a sub-agent to return:

- the callers and dependants of the code that is likely to change,
- the existing tests for that code and for those callers.

Run those tests to get a green baseline. For behaviour the fix may touch that has no test, add a test that pins the _current_ behaviour first, only for what the fix touches and not for the whole module.

### 4. Hypotheses

Write 3–5 ranked hypotheses before testing any. Each must be falsifiable: "If X is the cause, then changing Y makes the bug disappear (or Z makes it worse)." If you cannot state the prediction, discard or sharpen the hypothesis.

Show the list to the user before testing; they often know something that re-ranks it. Do not block on it if they are away.

When the failure is deep in a call stack, trace the bad value backwards: where does it come from, what passed it in, and keep going up until you reach where it originates. Fix at the source, not where it shows up.

### 5. Test the hypotheses

Each probe maps to one prediction. Change one variable at a time.

Prefer a debugger or REPL over logs, and targeted logs at the boundaries that tell hypotheses apart over logging everything. Tag every debug log with a unique prefix, e.g. `[DEBUG-a4f2]`, so cleanup is one search.

A hypothesis that fails goes back to the list; do not stack another change on top. When you do not understand something, say so.

### 6. Root cause, then decide the size

State the root cause and the evidence for it. Then:

- **Small fix:** a change to a function or code that does not change an interface. Go to step 7.
- **Large fix:** it changes an interface or contract, needs a design choice, or spreads across modules. Stop. Give a short summary of the cause and why the fix is not small, and suggest continuing with `grill-me`, then `write-spec`.

### 7. Fix

1. Turn the minimised repro into a failing test at a seam that exercises the **real** bug pattern at its call site. Watch it fail. If you forced the red by mutating code or a fixture, compare against a pristine copy to prove the mutation landed.
2. If no such seam exists, that is a finding: the structure of the code prevents the bug from being locked down. Say so, and do not write a shallow test that gives false confidence.
3. Make one change that addresses the root cause. No "while I'm here" edits.
4. Watch the test pass, run the tests from step 3, then run the original loop against the un-minimised scenario.

If a test that passed before now fails because the fix changed behaviour other code relied on, do not change that test yourself. Show the user which tests encode the old behaviour and ask whether they should change.

**If a fix does not work,** stop and return to step 4 with what you learned; do not try another on top. After **three** failed fixes, stop trying: each fix revealing a new problem elsewhere means the structure is wrong, not the hypothesis. Tell the user and discuss before going on.

### 8. Confirm

Show the evidence: the loop is green, the new test passes, the related tests pass, the original scenario no longer fails. Ask the user to confirm the bug is fixed. Keep the changes uncommitted and the debug logs in place until they do, so they can check for themselves.

After confirmation:

- remove every `[DEBUG-...]` line (search the prefix) and any throwaway scripts,
- prepare the commit text: the root cause and the hypothesis that proved correct, so the next person learns from it.

Commit only when the user asks.
