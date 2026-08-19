# greenfield-discovery

Greenfield on-ramp into `technical-discovery`: create a specification
directly (no brainstorm, no codebase analysis), gate on approval of the
spec, then hand off for architecture design. Use this when the user already
knows what they want to build and doesn't need an ideation pass
(`ideation-discovery`) or a brownfield analysis (`brownfield-discovery`)
first.

## Step 0 — resolve paths and policy

```
/artifact-resolver spec
```

Build `pathContext = {"spec": {...}}`. Read `.propel/gate-policy.json` and
pass its raw content as `gatePolicyJson` on `StartWorkflowRun`.

## Step 1 — start the run

```
StartWorkflowRun(workflow="greenfield-discovery", version="1.0", project=<projectName>,
                  inputs={"scope": <user's scope>}, rawInvocation=<literal command>,
                  pathContext=<from Step 0>, aiSignal=<...>, gatePolicyJson=<from Step 0>)
```

Report the `gatePlan`. S1's gate (`create-spec`) is policy-MANDATED via the
global `prompt: "create-spec"` rule in `gate-policy.json` -- an `--approve=`
request cannot lower it.

## Step 2 — execute S1 inline (create-spec)

1. `GetNextRunStep(project, runId)` → fetch directive
2. Execute spec creation inline (ask clarifications via `AskUserQuestion` as needed)
3. `CompleteRunStep(project, runId, stepId="S1", envelope={artifacts, facts, ...})`

## Step 3 — S1 gate decision

If `status: "gate_pending"`, render via `AskUserQuestion` (probe-user contract):
- Approve: `SubmitGateDecision(approve)` → handoff
- Reject: `SubmitGateDecision(reject, feedback=<reason>)` → loop back to S1
- Skip: `SubmitGateDecision(skip)` → S1 is the only step in this workflow, so
  this behaves the same as approve (no `skip_pending` step follows)
- Abort: `SubmitGateDecision(abort)` → exit, no handoff

## Responding to skip_pending

`status: "skip_pending"` names a step that has NOT run yet. Ask the user via
`AskUserQuestion` (probe-user contract) whether to proceed, skip it too, or
abort: `SubmitGateDecision(stepId=<named step>, decision="proceed"|"skip"|"abort")`.
This workflow only has one step, so in practice `skip_pending` won't arise
here -- it's documented for consistency with the other on-ramp workflows and
`technical-discovery`.

## Handoff

On `status: "complete"`, hand off into `technical-discovery` per the
response's `handoffTo`.

## Invariants

- Never call `SubmitGateDecision` without an explicit user decision, or with
  empty `feedback` on a `reject`.
- `propel-greenfield-discovery-s1` subagent must never call
  `SubmitGateDecision` itself -- it stops at `CompleteRunStep` and returns
  its result. Gate handling stays with the parent session.
