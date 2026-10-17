# HTML Report Format

The review is one self-contained HTML file in `docs/architecture-reviews/`, left uncommitted. Tailwind and Mermaid come from CDNs. Mermaid handles graph-shaped diagrams; hand-built divs and inline SVG handle the more editorial visuals (mass diagrams, cross-sections). Mix the two; do not lean on Mermaid for everything.

## Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review for {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header

Repo name, date, the scope that was reviewed (direction or hot spots), and a compact legend: solid box = module, dashed line = seam, red arrow = leakage, thick dark box = deep module. No introduction paragraph.

## When nothing was found

Replace the candidates with one short section: the scope, what was checked, and that the architecture looks fine there. List weak candidates, if any, as `Speculative` cards. No top recommendation.

## Candidate card

The diagrams carry the weight. Prose is sparse and uses the vocabulary without ceremony. Each candidate is one `<article>`:

- **Title**: short, names the deepening (e.g. "Collapse the Order intake pipeline").
- **Badge row**: strength (`Strong` emerald, `Worth exploring` amber, `Speculative` slate) and the dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock`).
- **Files**: monospaced list.
- **Before / After diagram**: the centrepiece, two columns side by side.
- **Problem**: one sentence. What hurts, and the evidence (for example how often the area changed).
- **Solution**: one sentence in plain English. What changes. No interface, signatures or steps.
- **Wins**: bullets, at most six words each, in vocabulary terms ("locality: bugs concentrate in one module", "leverage: one interface, N call sites", "delete 4 shallow wrappers"). Say which tests get simpler. Never "cleaner" or "easier to maintain".
- **Open point** (if any): one line on what you could not settle and the user must know, such as a constraint, a plan, or a documented decision the candidate would contradict.

No paragraphs. If a diagram needs a paragraph to be understood, redraw it.

## Diagram patterns

Pick the pattern that fits the candidate and mix them.

- **Mermaid graph** for dependencies and call flow ("X calls Y calls Z, and look at the mess"). Wrap it in a styled card. Colour leakage edges red and the deep module dark with `classDef`. Sequence diagrams suit "before: 6 round-trips; after: 1".

  ```html
  <div class="rounded-lg border border-slate-200 bg-white p-4">
    <pre class="mermaid">
      flowchart LR
        A[OrderHandler] --> B[OrderValidator]
        B --> C[OrderRepo]
        C -.leak.-> D[PricingClient]
        classDef leak stroke:#dc2626,stroke-width:2px;
        class C,D leak
    </pre>
  </div>
  ```

- **Hand-built boxes and arrows** when Mermaid's layout fights you. Modules as bordered `<div>`s, arrows as inline SVG over a relative container. Use it for an "after" that is one thick-bordered deep module with greyed-out internals.
- **Cross-section** for layered shallowness. Stacked horizontal bands. Before: six thin layers doing nothing. After: one thick band with the consolidated responsibility.
- **Mass diagram** for "interface as wide as implementation". Two rectangles per module, interface and implementation. Before: nearly equal heights. After: short interface, tall implementation.
- **Call-graph collapse.** Before: a tree of calls as nested boxes. After: the same tree in one box with the now-internal calls faded.

## Style

- Editorial, not a corporate dashboard. Generous whitespace.
- One accent colour (emerald or indigo), red for leakage, amber for warnings.
- Diagrams about 320px tall so before and after sit side by side.
- `text-xs uppercase tracking-wider` for module labels inside diagrams.
- The only scripts are the Tailwind CDN and the Mermaid import. No app code, no interactivity.

## Top recommendation

One larger card: the candidate name, one sentence on why it comes first, an anchor link to its card.

## Tone

Plain English, concise, with the vocabulary of VOCABULARY.md used exactly. No hedging, no throat-clearing. Phrasings that fit: "Order intake module is shallow: interface nearly matches the implementation." "Pricing leaks across the seam." "Two adapters justify the seam: HTTP in production, in-memory in tests." If a term is not in the vocabulary, reach for one that is before inventing a new one.
