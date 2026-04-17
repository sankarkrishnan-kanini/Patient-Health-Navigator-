---
name: frontend-design
description: Force a single, named aesthetic direction before any token, typography, or layout decision. WHEN: "/frontend-design direction", "choose aesthetic direction", "brand personality", "visual identity selection", or before deriving design tokens/hi-fi UI.
license: MIT
metadata:
  author: KANINI
  version: 1.0.0
---

## Purpose

PropelIQ authority on the one decision upstream of every visual choice: **which aesthetic direction does this product commit to?** Without a committed direction, tokens, typography, and motion are made case-by-case and converge on generic AI defaults. With a direction, every downstream choice has something to honor or violate.

Compliance constraints (WCAG, required states, fidelity definitions, responsive breakpoints) are owned by `rules/ui-ux-design-standards.md` and `rules/web-accessibility-standards.md`. Token values, motion curves, and anti-pattern catalog are owned by the reference files below and consumed inline by calling workflows — not by this skill.

---

## Mode — `direction`

Invoke as `/frontend-design direction [inputs]`. One mode. No other routing.

**Inputs:** personas, product tone signals, brand references, domain — sourced from the calling workflow's resolved input.

**Process:**
1. Read `references/aesthetic-directions.md` for the closed set of seven directions.
2. Match inputs to exactly one direction. Reject hedged answers ("modern and clean" is not a direction).
3. Produce the four-field output below.

**Output shape:**
```text
Direction: [minimalist | editorial | brutalist | retro-futuristic | maximalist | utilitarian | expressive]
Rationale: [1 paragraph tying direction to personas, tone, and domain]
Precedents: [three named products, sites, or publications]
Anti-brief: [what this product must not resemble]
```

The seven-direction list is closed by design — the value is the forcing function. Do not treat it as "not limited to."

---

## References

Consumed by callers, not by this skill:

- `references/aesthetic-directions.md` — the seven directions, traits, precedents, anti-uses (read by this skill's `direction` mode)
- `references/color-typography-systems.md` — OKLCH construction, semantic layering, modular typography scales, pairing examples (consumed inline by create-figma-spec Phase 7.2)
- `references/motion-interaction.md` — state-change moments, easing, reduced-motion compliance (consumed inline by create-figma-spec Phase 7.2 and generate-wireframe hi-fi)
- `references/anti-patterns.md` — hard bans, soft bans, detection regexes, replacements (consumed by challenge-artifact as an extended rule; regexes inlined into calling workflows' quality gates)

## Error Handling

| Error | Message | Remediation |
|---|---|---|
| Hedged direction | "Input yields no single direction" | Reject; request stronger signals from user |
| No match in closed set | "No match in the seven directions" | Pick nearest; state the violation explicitly |
| Missing inputs | "Insufficient inputs for direction" | Escalate to /probe-user for elicitation |
