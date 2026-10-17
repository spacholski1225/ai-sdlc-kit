---
name: init-domain
description: Build or extend DOMAIN.md for an existing repository: the business language, processes and rules of each bounded context, extracted from the code and confirmed with the user. Works one context at a time so large legacy codebases can be mapped incrementally. Use when a repo has no DOMAIN.md, or when a context in it is not yet mapped.
disable-model-invocation: true
---

# Init Domain

Give agents the business understanding of an existing codebase, in pieces small enough to load. The code is the primary source: it is the business processes, implemented. The user is asked only what the code cannot settle.

Formats for every file this skill writes are in [FORMAT.md](./FORMAT.md).

## Principles

- **Code first.** Finding facts is your job, never the user's. Send sub-agents to read the code; they return compact findings, never raw code.
- **Partial is fine, empty is not.** Legacy domains are rarely known by one person: one team knows one module, another team another. Map what can be confirmed and record what cannot. A context gets a section only when it holds content an agent can rely on. If too little can be confirmed, write nothing for that context: no file is better than an empty or weak one.
- **One context at a time.** In a large repo, one context done well beats all of them done poorly. Do not map everything in one run.
- **Only confirmed content in `DOMAIN.md`.** No drafts, no guesses, no markers. Something is either settled and written down, or it is an open question in `OPEN-QUESTIONS.md`.
- **Business language only.** No code, file paths, or line numbers. Name modules and areas, not files.
- **Loadable.** A `DOMAIN.md` must be readable in one go. If a context grows past that, split the context.

## Layout

Decided at step 2 and confirmed by the user:

- **Small repo or a single context:** one `DOMAIN.md` at the repo root holding the map and the context.
- **Several contexts:** the root `DOMAIN.md` is only the map. Each context has its own `DOMAIN.md` in its directory (or `docs/domain/<context>.md` when it has no single directory).

Open questions for the business live in one `OPEN-QUESTIONS.md` at the repo root, each tagged with its context.

Agents that use this domain knowledge read the root `DOMAIN.md` first, then only the contexts the task touches.

## Process

### 1. Orient

Read `DOMAIN.md` and `OPEN-QUESTIONS.md` if they exist. If a map exists, this is an extension run: show the contexts and their status, then go to step 3. Otherwise this is a first run.

### 2. Survey (first run)

Dispatch a sub-agent to propose the bounded contexts from the code: modules, namespaces, database schemas, entry points, how the parts talk to each other. Shallow, not deep. For each context return its name, location, one-line purpose, the contexts it talks to, and any term that seems to mean different things in different contexts.

Present the proposed contexts and the proposed layout. The user confirms or corrects. Do not write the map yet: it is written together with the first context that is solid enough to write (step 6). If the run ends without one, no `DOMAIN.md` is created.

### 3. Choose contexts

Ask which context(s) to map now. Recommend one, preferring the one the user (or someone reachable) knows best. In a large repo, do not take more than one or two per run.

### 4. Extract

Dispatch a sub-agent per chosen context. It reads the code the way an archaeologist would: nouns (entities, tables) as candidate terms, verbs (operations) as candidate processes, conditionals and validations as business rules, enums and status fields as states, tests as intended behaviour, git history for _why_ a rule exists. It returns findings in compact form, split into:

- what the code makes clear,
- what the code leaves ambiguous (the business meaning, the reason, which of two readings is right).

### 5. Confirm

Show what the code made clear as a draft context section and ask what is wrong or missing. Do not interrogate the user about things the code answers.

Ask about the ambiguous items in rounds, in the style of the `grill-me` skill: the whole frontier at once, numbered, each with your recommended answer worded so that "yes" accepts it. Skip its closing step; there is no spec to write here.

- The user knows: the answer goes into the context section.
- The user does not know, or another team does: the question goes into `OPEN-QUESTIONS.md` with the team or person to ask, if the user knows. This is written even when the context itself ends up unmapped.

### 6. Write

For each context, judge what was confirmed. If it is enough to rely on, write the context section as you go, not at the end. If it is not, leave the context unmapped and write nothing for it.

The first time a context is written, create the root `DOMAIN.md` map with it, listing the other surveyed contexts as `not mapped`. Put terms that mean different things across contexts in the map's overloaded-terms list. Set the written context's status to `mapped` or `partial`.

### 7. Report

Say which contexts are mapped, which remain (and why, for those skipped for lack of confirmed knowledge), and how many open questions there are. If open questions need people outside the session, offer to turn selected ones into a questionnaire for them.
