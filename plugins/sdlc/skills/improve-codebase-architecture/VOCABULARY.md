# Vocabulary

The shared language for talking about deep modules. Use these terms exactly; consistent language is the whole point.

## Terms

**Module**: anything with an interface and an implementation. Scale-agnostic: a function, class, package, or a slice spanning tiers. _Avoid_: unit, component, service.

**Interface**: everything a caller must know to use the module correctly: the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. _Avoid_: API, signature (too narrow, they cover only the type-level surface).

**Implementation**: what is inside a module, its body of code. Distinct from **adapter**: a small adapter can have a large implementation (a Postgres repo) and a large adapter a small one (an in-memory fake). Say "adapter" when the seam is the topic, "implementation" otherwise.

**Depth**: leverage at the interface. The amount of behaviour a caller (or test) can exercise per unit of interface they must learn. A module is **deep** when a lot of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation.

**Seam** (Michael Feathers): a place where behaviour can be altered without editing in that place; the location where a module's interface lives. Where to put the seam is a design decision of its own, separate from what goes behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. It names a role (the slot it fills), not what is inside.

**Leverage**: what callers get from depth. More capability per unit of interface learned. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge and verification concentrate in one place instead of spreading across callers. Fix once, fixed everywhere.

## Deep versus shallow

```
Deep                         Shallow
┌─────────────────────┐      ┌─────────────────────────────────┐
│   Small interface   │      │        Large interface          │
├─────────────────────┤      ├─────────────────────────────────┤
│                     │      │   Thin implementation           │
│  Deep implementation│      │   (passes through)              │
│                     │      └─────────────────────────────────┘
└─────────────────────┘
```

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be built from small, swappable parts internally; they are just not part of its interface. A module can have **internal seams** (private to the implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test past the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam, two adapters a real one.** Do not introduce a seam unless something actually varies across it.

## Dependency categories

The category of a cluster's dependencies decides how a deepened module would be tested across its seam.

1. **In-process.** Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface. No adapter needed.
2. **Local-substitutable.** Dependencies with a local test stand-in (an embedded database, an in-memory filesystem). Deepenable if the stand-in exists; the module is tested with it running in the suite. The seam is internal.
3. **Remote but owned.** Your own services across a network. A port (interface) sits at the seam; the deep module owns the logic and the transport is an injected adapter. Tests use an in-memory adapter, production an HTTP/queue adapter.
4. **True external.** Third-party services you do not control. The module takes the dependency as an injected port; tests supply a mock adapter.

## Seam discipline

- Do not add a port unless at least two adapters are justified (usually production plus test). A single-adapter seam is only indirection.
- Do not expose internal seams through the interface just because tests use them.

## Tests after a deepening

Old unit tests on the shallow modules become waste once tests at the deepened module's interface exist. Tests assert observable outcomes through the interface and survive internal refactors. A test that must change when the implementation changes is testing past the interface.

## Rejected framings

- Depth as a ratio of implementation lines to interface lines: it rewards padding the implementation. Depth here is leverage.
- "Interface" as the language keyword or a class's public methods: too narrow.
- "Boundary": overloaded with bounded context. Say **seam** or **interface**.
