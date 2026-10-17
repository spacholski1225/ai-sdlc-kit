---
name: write-tickets
description: Break a written spec (docs/specs/<slug>.md) into detailed, ordered tickets that a junior engineer or a weaker agent can implement one by one, and save them to docs/specs/todo_<slug>.md. Built from the spec and the current code. Use after write-spec, or when the user points at an existing spec and wants it turned into tickets.
---

# Write Tickets

Turn a spec into tickets. The spec says _what_ and _why_ and stays general; the tickets say _where_ and _what exactly_, based on the code as it is now.

A ticket is done when the implementer can write exactly one reasonable thing from it. That is the whole requirement: unambiguous, not complete. A ticket that is longer than the code it describes has written the code instead.

## Process

### 1. Gather

- Take the spec path from the user, or the spec just written in this conversation. If there is none, list `docs/specs/` and ask which one.
- Read the spec in full. Read the relevant parts of `DOMAIN.md` (map first, then only the contexts the spec touches) and use its vocabulary.
- If the spec's Open questions block part of the work, tell the user which ones. Tickets that depend on an unanswered question are not written; ask whether to leave that part out or settle the question first.
- If `docs/specs/todo_<slug>.md` already exists, show it to the user and ask whether to replace it before going further.

### 2. Draft the breakdown (sub-agent)

Dispatch a sub-agent with the spec path. It reads the code and returns a **breakdown only**, not the detailed tickets:

- For each ticket: title, blocked-by, the end-to-end behaviour it delivers, and which of the spec's required behaviours it covers.
- Per ticket, the code facts it found: the places that will change, existing seams and helpers that can be reused, prior art for the tests.
- Anything in the code that contradicts or complicates the spec.

The rules it works by:

- **Vertical slices (tracer bullets).** Each ticket cuts a narrow but complete path through every layer it needs and can be verified on its own. No ticket is a horizontal slice of one layer.
- **Right-sized.** A ticket is the smallest unit that carries its own test cycle and is worth a separate review. Fold setup, configuration and documentation into the ticket whose deliverable needs them. Split only where a reviewer could reject one ticket and approve its neighbour. It must fit in one fresh context window.
- **Prefactor first.** If the code needs reshaping to make the change easy, that is the first ticket.
- **Wide refactors are the exception.** For one mechanical change that touches the whole codebase (rename, retype a shared symbol), use expand-contract: add the new form beside the old, migrate callers in batches (each its own ticket), then delete the old form.
- **Blocking edges.** Each ticket lists only the tickets that genuinely gate it. One with no blockers can start now.
- **Tests at the spec's seam.** Every ticket's tests are written at the seam agreed in the spec. A ticket that needs another seam is a signal to go back to the user.
- **Every required behaviour in the spec is covered by at least one ticket,** and every ticket traces to at least one behaviour. A ticket with no spec behind it is out of scope.

### 3. Approve the breakdown

Show the user a numbered list: title, blocked by, what it delivers. Add anything from the sub-agent's report that contradicts the spec. Ask whether the granularity is right, whether the blocking edges are correct, and whether any tickets should be merged or split. Iterate until approved. Nothing is written before this.

If the code contradicts the spec in a way that changes a decision, stop and send the user back to `write-spec`; do not quietly deviate from the spec.

### 4. Write the tickets (sub-agent)

Dispatch a sub-agent with the spec path, the approved breakdown and its code facts. It writes `docs/specs/todo_<slug>.md` in dependency order (blockers first), using the format below.

### 5. Self-review

Check the file yourself against the spec:

1. **Coverage:** every required behaviour and every Implementation decision in the spec points to a ticket. List gaps and add the ticket.
2. **Step scan:** each ticket lets the implementer write exactly one reasonable thing. A line that decides nothing ("handle edge cases", "add appropriate validation", "write tests for the above", a type or function no ticket defines) is a gap. A function body that the signature and tests already determine is a transcript. Fix both.
3. **Consistency:** names, signatures and types used in later tickets match what earlier tickets define.
4. **Proportion:** if the file is several times longer than the spec, or mostly code blocks, replace bodies with signatures, test names and assertions.

Fix what you find inline. Then give a short summary in chat: the file path, the number of tickets and the order they can run in, and anything the spec left open that affects them. Do not paste the file.

## Format

Everything here is for the implementer. Paths, signatures and names are allowed (the spec forbids them because it goes stale; tickets are written from the current code and executed soon after).

```markdown
# Tickets: <spec title>

**Spec:** docs/specs/<slug>.md

## Global constraints

The spec's project-wide requirements (versions, dependency limits, naming and copy rules), exact values copied verbatim from the spec, one per line. Every ticket includes these implicitly.

---

## T1: <title>

- [ ] **Status:** not started
- **Blocked by:** None (can start immediately)
- **Covers:** the required behaviours of the spec this ticket implements

**What to build:** the end-to-end behaviour this ticket makes work.

**Files:**
- Create: `path/to/file`
- Modify: `path/to/existing:123-145`
- Test: `path/to/test`

**Interfaces:**
- Consumes: what this ticket uses from earlier tickets (exact signatures).
- Produces: what later tickets rely on (exact names, parameter and return types). An implementer sees only their own ticket; this block is how they learn the names used by neighbouring tickets.

**Tests** (at the spec's seam):
- `test_name`: the situation and the exact assertions, with the spec's exact values.

**Implementation:** the exact signature (name, parameters, return type) and where it lives; the values the spec pins. One line on the approach only where the signature and the tests leave a real choice. A body appears only for an algorithm they do not determine, or exact copy the spec fixes.

**Done when:** the command to run and the result that means it passed.
```

## Rules

- **Do not make new decisions.** If a ticket needs a choice the spec does not settle, ask the user or send them back to `write-spec`; do not pick silently.
- **Stay inside the spec's scope.** Anything under Out of scope gets no ticket.
- **One file.** All tickets live in `docs/specs/todo_<slug>.md`, with the status checkbox of each ticket updated as work proceeds.
