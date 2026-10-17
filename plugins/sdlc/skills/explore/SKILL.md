---
name: explore
description: Work out how to solve a problem when the user has the problem but not the solution: nobody yet knows what to build or how it should work. Claude brings the knowledge (codebase recon, options with trade-offs, an optional throwaway spike) until the user picks a direction, then hands off to grill-me. Use when the user has a problem and is looking for a solution. Not for bugs where the expected behaviour is known (debugging), and not when the direction is already chosen (grill-me).
---

# Explore

The user has a problem and does not know the solution. Nobody holds the answers yet, so questioning alone gets nowhere: you bring the knowledge. Your job is to take the problem to a **chosen direction**, which `grill-me` then sharpens into a design.

Change nothing in the repository, except a spike the user agreed to.

## Process

### 1. Understand the problem

Get the user describing the problem, not the solution. Ask 1–3 open questions per message about the problem itself: what hurts, when it happens, what they already tried, what constraints they have, what a good outcome looks like. Anchor them in specifics ("Walk me through the last time this bit you").

Prefer a guess they can correct ("I'm guessing this is because X keeps biting you?") to a bare question, and mark it as a guess. Do not offer solutions yet; options steer, and the user's own words carry what matters.

Stop asking when you could describe the problem back in a few sentences and the user agrees. Play it back to confirm.

Redirect early when the problem is of another kind:

- the expected behaviour is known and the code does not do it: this is a bug, suggest `debugging`;
- the direction is already chosen and only needs sharpening: suggest `grill-me`.

### 2. Recon

Find out what you need before proposing anything.

- **The codebase:** send sub-agents to read it, without asking permission. They return compact findings: how the relevant part works today, what already exists that could be reused, constraints it imposes. Read `DOMAIN.md` if it exists (the map first, then only the contexts the problem touches) and use its vocabulary.
- **The web:** only with the user's consent, because it costs tokens. Say what you would look for and why, and let them decide. When they agree, go to primary sources (official docs, source code, specifications) rather than write-ups of them, and note where each claim came from.

Finding facts is your job, never the user's.

### 3. Options

Think wide privately: come up with several approaches and drop the weak ones, including any that fight what the user told you about the problem. Show the user the 2–4 that are worth considering. If only one is sensible, say so rather than inventing alternatives.

For each option: how it works in a few lines, what it costs, what it risks, and what it would mean for the existing code. Give one recommendation and why. Mark anything you are unsure of as such.

### 4. Spike (optional)

Offer a spike when an option's feasibility or feel cannot be settled by reading, and a quick build would answer it. Say what question it answers.

A spike is throwaway code that answers one question:

- clearly marked as a spike and kept apart from the production code,
- no tests, no error handling beyond what it needs to run, no persistence,
- trivial to run, with the relevant state shown so the user sees what happened,
- never turned into production code. Keeping what it produced is a new decision, made later through `grill-me` and `write-spec`.

Bring the answer back into the conversation. Delete the spike afterwards unless the user asks to keep it on a separate branch.

### 5. Close

The skill is done when the user chooses a direction, or when you agree that none of the options fits. Then stop and give a short summary in chat:

- the problem, in the user's terms,
- the options considered and the reasons the others were dropped,
- the chosen direction,
- what the spike showed, if there was one,
- what is still unknown.

Mark what is your judgement rather than something the user said. Do not write a file unless the user asks.

End by asking the user whether to continue with `grill-me`, which turns the chosen direction into a settled design. If no option fit, say what would have to change and ask how to go on.
