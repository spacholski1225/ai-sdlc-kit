---
name: write-spec
description: Turn the shared understanding reached in the conversation (usually after grill-me) into a written spec saved in the repo. No new interview, only synthesis, plus one check of the test level with the user. Use when the design is settled and the user wants it written down as a spec.
---

# Write Spec

Produce a spec from what the conversation has already settled. Do NOT interview the user: the spec records decisions, it is not a place to make new ones. If the spec states something the user never said and you did not mark it as your call, that is a defect.

The spec stays general. It says _what_ and _why_, never _where_ or _how in code_. The detailed, junior-level instructions belong to the tickets, which are built later from the spec and the code as it is then.

## Process

### 1. Gather

- Read `DOMAIN.md` if it exists: the map first, then only the contexts this change touches. Use its vocabulary throughout the spec.
- Read `OPEN-QUESTIONS.md` if it exists and note the entries the change touches.
- Explore the repo only as far as needed to describe the current state accurately. Send a sub-agent for anything that takes more than a quick look.
- Re-read the conversation and sort every decision into two groups: **agreed** (the user said or confirmed it) and **Claude's call** (you filled a gap and the user never weighed in).

### 2. Agree the test level

Pick the **seam** at which the change will be tested. Prefer an existing seam to a new one, and the highest seam possible. The fewer seams, the better; the ideal is one.

Ask the user in one message: your recommended seam, one or two alternatives with a line on the trade-off, and the behaviours you would verify there. Word it so "yes" accepts your recommendation. This is the only question this skill asks.

If the user changes the seam, use their answer.

### 3. Check size

A spec covers one change. If the settled scope is clearly too big to build and review as one, say so and suggest going back to `grill-me` to split it into separate changes. Do not split it into parts inside one spec.

### 4. Write

Save to `docs/specs/<slug>.md` in the repo, using the template below. Pick a short kebab-case slug from the change; if the file already exists, show the user and ask before overwriting.

Afterwards give a short summary in chat: the file path, the seam, anything marked as Claude's call, and the open questions. Do not paste the whole spec.

End by asking the user whether to continue with `write-tickets`, which breaks the spec into tickets for implementation.

## Rules

- **Mark the source of each decision.** In Implementation Decisions, each decision ends with _(agreed)_ or _(Claude's call)_. Claude's calls are what the user should check first.
- **Domain vocabulary.** Use the terms from `DOMAIN.md`. If you need a term it does not define, say so in Open questions rather than inventing a meaning.
- **No file paths, no code.** They go stale quickly. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, schema, type shape), inline it inside that decision and note it came from a prototype. Keep only the decision-rich part.
- **Behaviours, not stories.** Required behaviours are short, verifiable statements, not "As a..., I want..." stories.
- **Nothing silently dropped.** Anything discussed and rejected goes to Out of Scope; anything unresolved goes to Open questions.

## Template

```markdown
# <Title>

## Problem

The problem from the user's point of view.

## Solution

The solution from the user's point of view.

## Required behaviour

A short list of statements that can be checked as true or false.

- When <situation>, <what must happen>.

## Implementation decisions

Decisions that were made: what is built or changed, the interfaces between parts, schema or contract changes, rules and edge cases. Each ends with _(agreed)_ or _(Claude's call)_.

## Testing

- **Seam:** the level at which the change is tested.
- **Alternatives considered:** the other seams and why they were not chosen.
- **Behaviours to verify:** the required behaviours that the tests at this seam must cover. Test external behaviour, not implementation details.

## Out of scope

What this spec deliberately does not cover.

## Open questions

Unresolved points the spec depends on, including entries from `OPEN-QUESTIONS.md` that the change touches (name the entry). Say what each blocks, and who to ask if known.
```
