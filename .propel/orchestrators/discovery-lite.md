# discovery-lite

Lightweight, gate-enforced on-ramp into `technical-discovery`: brainstorm
ideas, pause for approval, then hand off. One step, one gate -- the smallest
gate-enforced workflow in the catalog. Use this instead of
`concept-validation` when there's no prototyping phase wanted, just a
reviewed brainstorm before full discovery.

*Formerly `discovery-mini`, the catalog's ungated comparison baseline
("no approval gate — baseline for gate comparison"). Renamed and upgraded to
gate-enforced alongside the `technical-discovery` rollout. `discovery-mini-gated`
is unrelated and still exists separately, unchanged, as a client-trusted demo
of the old declarative-gate pattern -- not migrated to the new tools.*

## Step 0 — resolve paths and policy

```
/artifact-resolver brainstorm
```

Build `pathContext = {"brainstorm": {"path": ..., "content_type": ..., "mcp_type": ...}}`.
Read `.propel/gate-policy.json` and pass its raw content as `gatePolicyJson`.

## Step 1 — start the run

```
StartWorkflowRun(workflow="discovery-lite", version="1.0", project=<projectName>,
                  inputs={"scope": <user's scope>}, rawInvocation=<literal command>,
                  pathContext=<from Step 0>, aiSignal=<...>, gatePolicyJson=<from Step 0>)
```

Report the `gatePlan`. S1's gate resolves to `always` via the manifest default
(no `condition` field) -- it is not separately policy-mandated the way
`technical-discovery`'s steps are, so an `--approve=none` request WILL lower
it unless you add a matching rule to `gate-policy.json`. Decide deliberately
whether that's acceptable for this workflow before relying on the default.

## Step 2 — execute S1 (brainstorm-idea)

**Session isolation is host-specific -- follow your shim**:
`.claude/commands/discovery-lite.md`, `.github/prompts/discovery-lite.prompt.md`,
or `.windsurf/workflows/discovery-lite.md`. This is a single-step workflow so
the isolation need is smaller than the other two orchestrators, but the
mechanism (if any) still shouldn't be prescribed in this shared file.

`status: "gate_pending"` → STOP, render via `AskUserQuestion` per
`probe-user`'s contract, then `SubmitGateDecision` with the user's decision
(feedback required on reject).

## Handoff

On `status: "complete"`, hand off into `technical-discovery` per the
response's `handoffTo`.

## Invariants

- Never call `SubmitGateDecision` without an explicit user decision, or with
  empty `feedback` on `reject`.
- `propel-discovery-lite-s1` must never call `SubmitGateDecision` itself.
