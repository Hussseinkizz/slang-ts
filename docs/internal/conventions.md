# Conventions: Documentation & Communication

**Version:** 1.0
**Date:** August 9, 2026
**Author:** Hussein Kizz

Guidance distilled from implementation sessions (SuperPromise/SuperRunner/Channel, v0.0.8). Applies to README, spec docs, JSDoc, and example files. Follow these over default instincts; the old README intentionally bends documentation-rules.md where the voice demands it.

## 1. Aliases

- **The library exports no aliases.** Ship full names only (`superPromise`, not `sp`). A built-in alias is a black box: the reader can't tell what it stands for.
- **Importers alias locally** when they want a short name: `import { superPromise as sp }`. Evident, explicit, nothing hidden.
- **The full word is preferred over the alias in examples.** Aliases are for tight code, not for teaching.
- **Use the alias where the full word gets ugly**, e.g. repeated calls in a runner's children list. Fine *after* the local alias has been shown once.
- Wording pattern: *"The library exports no short alias; if the name gets heavy, alias it yourself: `import { superPromise as sp }`."*

```text
Good:    superPromise(fetchData, { timeout: 5000, retry: 3 })
         import { superPromise as sp } from "slang-ts";
         runners: [sp(authenticate), sp(loadProfile)]   // alias shown above

Bad:     import { sp } from "slang-ts";                 // alias invented by the lib
         sp(fetchData, { timeout: 5000, retry: 3 })     // unexplained
```

## 2. Plain language over low-level mechanics

- **No low-level mechanism language in prose**: "controller aborting", "AbortController semantics", "microtask/event-loop details". Say what the user experiences.
- **Call signals "triggers" where it makes sense.** "Signal or trigger" is allowed to illustrate meaning. First mention: *"A trigger (we call them signals) is a switch that fires once and stays fired."*
- API names stay accurate (`task.abort()`, `addEventListener("abort")`): those are the real surface. Only the surrounding prose must be plain.
- "Fires", "goes off", "flip it", not "aborts", "cancels the controller".

```text
Bad:  Publish when a signal fires, a task finishing, a controller aborting, anything.
Good: Publish when a trigger goes off, a task finishing, anything at all.
```

## 3. Docs teach use, not semantics

- **Lead with the problem the utility solves**, then show code. The reader wants "how do I use this", not an API inventory.
- **Root new utilities in fundamentals** before explaining what makes them special. Anchor to what the reader already knows: SuperPromise is "native JavaScript promises plus execution controls", SuperRunner is "`Promise.all` and `Promise.race` grown up", a Channel is "a chat room for events". Relatable first, slang framing second.
- **Strip articles and "you" from intros**: "native JavaScript promises plus…", not "a JavaScript Promise on steroids". Terse, clipped, direct.
- **Frame briefings as "this is that, and can be used in such cases"**: plain language, brief, no term dumps.

```text
Bad:  SuperRunner (sequence, all, race) runs multiple SuperPromises.
Good: SuperRunner runs several SuperPromises together; use it to execute steps in
      order, fetch things in parallel, or take the first source that responds.
```

- Show **result shapes in comments** so the reader knows what they'll get back:

```ts
const ordered = await auth.start(); // [authResult, profileResult, dashboardResult]
```

- **Illustrate what the briefing claims.** If the briefing says "use it to make X start after Y", the section must contain that example. Every promise made in the briefing is a promise to keep in the section.

## 4. Voice

- Match the established README voice: casual, direct, occasional playful aside. The old README intentionally ignores some documentation-rules.md formality; that's the precedent.
- **No em dashes (—).** Replace with colons, commas, or parentheses. Applies to README, spec docs, JSDoc, and code comments.
- `println` in examples, not `console.log`.
- Short sections: intro line, example, done. Don't pad.

## 5. Lists and changelog sections

- **Implemented Utilities list must be complete**: every exported utility, including small ones (`println` was once missing).
- List items use **full words** for capabilities: `Channel (send, subscribe, when)`, not `(send, sub, when)`, even when the API spells it shorter.
- **No speculative "Planned" sections**: remove rather than maintain roadmap guesses.
- **"New in vX.Y.Z" section** for each release: utility name + one-line plain-language briefing of what it is and when to use it.

## 6. Verification

- Tests must be **meaningful**: real behavior assertions, self-contained values. Watch for fake assertions (`expect(x ? true : true).toBe(true)`, caught in review).
- **Example file runs**: every new utility gets a working example in `example.ts`; run it to prove the docs aren't lying.
- JSDoc follows the same rules: full word, trigger language, use-case framing.

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz)

*These conventions reflect lessons from implementation sessions and are subject to evolution.*
