---
name: prepare-pr
description: Prepare a reviewed feature branch for a pull request - update the existing documentation, add a changelog entry and bump the version (each only where the project already has one), check the branch for sensitive files, then write the PR description with a summary, evidence and a one-way or two-way door assessment. Use after review-branch, or when the user asks for a PR description. Does not create documentation from scratch, does not push and does not open the PR: it hands over the title and description to paste.
---

# Prepare PR

Get a branch that is already reviewed ready to be opened as a PR. You are the **supervisor**. A **docs-updater** sub-agent keeps the existing documentation and the changelog in line with the change, you propose the version bump, and you write the PR description. The user decides about the version and about anything uncertain.

Run this skill on the most capable model (Opus). The sub-agent is `sdlc:docs-updater` (Sonnet).

## Rules

- **Update what exists, create nothing.** Documentation, a changelog and a version are touched only where the project already has them. If it has none, say so in one line and move on. Writing new documentation is a separate job.
- **No padding.** If nothing documented is affected by the change, say "no document to change" and add nothing.
- **The version is the user's decision.** You recommend a level with the reason and wait for the answer.
- **Do not guess.** When it is unclear whether a document, a changelog format or a version scheme applies, ask the user.
- **Evidence comes from commands run now.** Every claim in the description about tests, build or behaviour is backed by output you produced in this session. No claim without fresh evidence.
- **Spec and tickets are not committed** and are not linked from the PR; the description carries what a reviewer needs from them.
- **Commits** have no Co-Authored-By line and contain explicit paths only, never `git add -A` or `.`, never untracked local files (`.env`, docker, helper scripts).
- **Nothing is pushed and no PR is opened**, on any forge. The output is text for the user to paste.
- **Secrets are never printed.** A finding names the commit and path, not the value.

## Process

### 1. Start

1. Check the branch: tracked files have no uncommitted changes (untracked files are fine and are never touched). If they do, tell the user and stop.
2. Pin the base: `git merge-base main HEAD` (ask if the main branch has another name). Capture `git diff <base>...HEAD` and `git log <base>..HEAD --oneline`. Stop if the diff is empty.
3. Collect what you will need, as paths: the spec and tickets files (probably untracked), `DOMAIN.md` if it exists, the `Decision:` lines from the tickets, and the final report of `review-branch` if it ran in this conversation (it holds the compat-reviewer's verdict).
4. Run the full test suite, typecheck and build with the repo's own commands, redirecting output to a file. Keep the results for the Evidence section. If anything fails, report it and stop.

### 2. Sensitive files

Check that nothing local or secret is on the branch. Look at all commits since the base, not only the final diff: a file added in one commit and deleted in a later one is still in the history.

1. List every file the branch touched: `git log <base>..HEAD --name-only --format=` and `git diff <base>...HEAD --name-only`. Flag names such as `.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials*`, `secrets*`, `*.p12`, `*.keystore`, `*.sqlite`/`*.db` dumps, local docker or compose overrides, helper scripts, logs, editor and OS files, worktree directories, and anything the repo's `.gitignore` says should be ignored but is tracked (`git ls-files -ci --exclude-standard`).
2. Search the added lines for secret-looking content: private key headers, `AKIA`-style cloud keys, `ghp_`/`sk-`/`xox` token prefixes, `password=`/`token=`/`secret=` with a literal value, connection strings with credentials, and URLs with embedded credentials. Use the repo's own scanner if it has one (gitleaks, trufflehog, a pre-commit hook); do not install anything.
3. Report the findings with the commit and path. Never print a secret's value; show the path and line only.

Do not fix this yourself. Removing a file from history rewrites commits and a leaked secret must be revoked by its owner, so show the findings and ask the user. If nothing is found, say so in one line.

### 3. Documentation and changelog

Start `sdlc:docs-updater` with the base, the diff command, the spec path and the decisions. Its brief is in the agent file; add nothing to it. It edits the existing documentation that the change makes wrong or incomplete, and adds the changelog entry. It makes two commits: `docs: <what>` for the documentation and `docs: changelog for <what>` for the entry, and reports what it changed, what it left alone and why.

Read its report and its diff. Fix anything wrong yourself or send it back; ask the user when it is unclear whether a statement in a document should change. The user sees the result in the PR, so you do not need approval before the edit, only a short summary afterwards.

### 4. Version

1. Find every place that holds the version with grep: package manifests and lockfiles, `pyproject.toml`, `Cargo.toml`, plugin manifests, plist, a constant in code, a badge in the README. If there is no version, skip this step and say so. If the repo's releases are cut by tooling (release-please, semantic-release, changesets) or by a separate process, do not bump; say that.
2. Follow the scheme the repo already uses (SemVer, 0.x, CalVer). Do not introduce one.
3. Recommend a level and give the reason: a breaking contract in the compat verdict means major, new behaviour means minor, a fix with no new behaviour means patch. Wait for the user's answer.
4. Change all the places at once, and the changelog heading if the repo's practice is to date the unreleased section on bump. One commit: `chore: bump version to <x.y.z>`.

### 5. Description

Write the PR description in chat. If the repo has a PR template (`PULL_REQUEST_TEMPLATE*`), use it and fit the content below into it. Otherwise use this one:

```markdown
## Summary

<one sentence: why this change exists>

<the smallest view that shows what changed>

## Evidence

- **Before:** <what was wrong, failing or missing>
  **After:** <the test or output that now passes>

## Merge Danger

**Door:** <one-way | two-way> - <the reason in one sentence>

**Blast Radius:** <one word>

**Rollback:** <the concrete step, or why there is none>
```

Keep prose short and use the terms in `DOMAIN.md`.

**Summary.** One sentence of why, taken from the spec. Then the smallest view that makes the point: a Mermaid diagram for interaction or flow, pseudocode for logic, a call or file tree for structure, a `diff`-marked tree when the point is what changed. Less is more: one view is usual, two is the limit.

**Evidence.** Before and after, from commands you ran. Name the exact test that fails without the change and passes with it, as pseudocode. A screenshot only if the change is visual and the environment can produce one. Do not describe tests you did not run.

**Merge Danger.** Start from the compat-reviewer's verdict, then check the diff yourself for signs that the door only opens one way: migrations and schema changes, deleting or rewriting data, a changed storage or wire format, a changed public contract, anything that sends data out or triggers an effect outside the repo. Two questions decide the door:

- Can the change be undone by reverting the commits?
- After the revert, does state that the new code already wrote still work with the old code?

If both answers are yes, it is a two-way door. If either is no, it is one-way: say what is lost or stuck, and give the rollback as a concrete step (revert plus a down-migration, a restore from backup, a feature flag to switch off). When you cannot tell, ask the user; do not call it two-way by default.

Give the PR title (short, in the repo's commit style) and the whole description, each in its own fenced block so the user can copy them in one go. The user works across GitHub, GitLab and self-hosted forges, so the skill never calls a forge CLI, never pushes and never opens the PR; the user pastes the text. Wait for the user's remarks and revise if asked.
