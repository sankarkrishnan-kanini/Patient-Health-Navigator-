# brownfield-discovery

Brownfield on-ramp into `technical-discovery`: analyze the existing
codebase, create a specification from the findings, gate on approval of the
spec, then hand off for architecture design. Use this instead of
`ideation-discovery`/`greenfield-discovery` when the starting point is an
existing codebase rather than a blank idea.

## Step 0 — resolve paths and policy

```
/artifact-resolver codeanalysis
/artifact-resolver spec
```

Build `pathContext = {"codeanalysis": {...}, "spec": {...}}`. Read
`.propel/gate-policy.json` and pass its raw content as `gatePolicyJson` on
`StartWorkflowRun`.

## Step 1 — start the run

```
StartWorkflowRun(workflow="brownfield-discovery", version="1.0", project=<projectName>,
                  inputs={"scope": <user's scope>}, rawInvocation=<literal command>,
                  pathContext=<from Step 0>, aiSignal=<...>, gatePolicyJson=<from Step 0>)
```

Report the `gatePlan`. S2's gate (`create-spec`) is policy-MANDATED via the
global `prompt: "create-spec"` rule in `gate-policy.json` -- an `--approve=`
request cannot lower it. S1 (`analyze-codebase`) carries no gate at all;
completing it advances straight into S2.

## Step 2 — execute S1 inline (analyze-codebase)

1. `GetNextRunStep(project, runId)` → fetch directive
2. Run the codebase analysis inline
3. `CompleteRunStep(project, runId, stepId="S1", envelope={artifacts, ...})` → advances directly to S2, no gate

## Step 3 — execute S2 inline (create-spec)

1. `GetNextRunStep(project, runId)` → fetch directive (includes S1's codebase analysis context)
2. Execute spec creation inline, informed by the codebase analysis
3. `CompleteRunStep(project, runId, stepId="S2", envelope={artifacts, facts, ...})`

## Step 4 — S2 gate decision

If `status: "gate_pending"`, render via `AskUserQuestion` (probe-user contract):
- Approve: `SubmitGateDecision(approve)` → handoff
- Reject: `SubmitGateDecision(reject, feedback=<reason>)` → loop back to S2
- Skip: `SubmitGateDecision(skip)` → S2 is the last step in this workflow, so
  this behaves the same as approve (no `skip_pending` step follows)
- Abort: `SubmitGateDecision(abort)` → exit, no handoff

## Responding to skip_pending

`status: "skip_pending"` names a step that has NOT run yet. Ask the user via
`AskUserQuestion` (probe-user contract) whether to proceed, skip it too, or
abort: `SubmitGateDecision(stepId=<named step>, decision="proceed"|"skip"|"abort")`.
Skip cascades one step at a time. This workflow only has two steps, so in
practice `skip_pending` won't arise here -- it's documented for consistency
with the other on-ramp workflows and `technical-discovery`.

## Handoff

On `status: "complete"`, hand off into `technical-discovery` per the
response's `handoffTo`.

## Invariants

- Never call `SubmitGateDecision` without an explicit user decision, or with
  empty `feedback` on a `reject`.
- `propel-brownfield-discovery-s1`/`s2` subagents must never call
  `SubmitGateDecision` themselves -- they stop at `CompleteRunStep` and
  return its result. Gate handling stays with the parent session.
