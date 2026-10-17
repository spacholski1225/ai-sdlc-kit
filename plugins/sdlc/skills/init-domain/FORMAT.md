# Formats

## Root `DOMAIN.md` (the map)

In a single-context repo, the context section below follows the map in the same file.

```md
# Domain

Read this map first, then only the contexts your task touches.

## Contexts

- [Billing](./src/billing/DOMAIN.md): issues invoices and collects payments. Status: mapped
- [Identity](./src/identity/DOMAIN.md): accounts, login, permissions. Status: partial
- Shipping: `src/shipping`. Status: not mapped

## Relationships

- **Ordering → Billing**: Ordering emits `OrderPlaced`; Billing starts an invoice from it.

## Overloaded terms

- **User**: Identity: a login account. Billing: the payer of an invoice.
```

Status is one of `mapped`, `partial`, `not mapped`.

## Context `DOMAIN.md`

```md
# {Context name}

{One or two sentences: what this part of the business is and why it exists.}

## Language

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

## Processes and rules

### {Process name}

{What triggers it, the steps in business terms, who or what takes part.}

- {A rule that governs it, and why it exists if known.}
- {Another rule.}
```

Rules for terms (from Pocock's glossary format):

- Be opinionated. When several words exist for one concept, pick the best and list the others under `_Avoid_`.
- Define what it _is_, in one or two sentences.
- Only terms specific to this project. General programming concepts do not belong.
- Group under subheadings when clusters emerge.

Rules for processes and rules:

- Business language. No code, file paths, or line numbers.
- One process per heading. State the rule and, when known, the reason for it.

## `OPEN-QUESTIONS.md`

```md
# Open questions

## {Context name}

### {The question, one idea}

- **Why it matters:** {what depends on the answer}
- **Where it came up:** {module or area, not file paths}
- **Ask:** {team, role or person, if known}
```

When a question is answered, move the answer into the context's `DOMAIN.md` and delete the entry.
