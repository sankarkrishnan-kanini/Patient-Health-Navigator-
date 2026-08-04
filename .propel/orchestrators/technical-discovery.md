# technical-discovery

Gate-enforced technical discovery: architecture design, optional system
modeling, and UI specification (Figma + wireframes, when the spec is
UI-relevant). Assumes a specification (`spec.md`) already exists on disk,
produced by an upstream on-ramp workflow (`ideation-discovery`,
`greenfield-discovery`, or `brownfield-discovery`) -- this workflow no
longer creates the spec itself.

## Step 0 — resolve paths and policy

```
/artifact-resolver design
/artifact-resolver model
/artifact-resolver figma_spec
/artifact-resolver wireframe
```

Build `pathContext` from all four results (same `{path, content_type,
mcp_type, quality_threshold}` shape as `concept-validation.md`). Read `.propel/gate-policy.json`
and pass its raw content as `gatePolicyJson` on `StartWorkflowRun` in Step 1
only -- `CompleteRunStep` and `SubmitGateDecision` don't need it. Gate
resolution happens once, at run start, and gets frozen into the run.

**Do not resolve `spec` here.** `spec` is not a `produces` key of any step
in this workflow anymore, so `BindRunPaths` doesn't require it. S1
(`design-architecture`) still reads `spec.md` directly -- it resolves that
path itself via its own `$REFERENCES` lookup during execution, not via this
run's `pathContext`. If `spec.md` doesn't exist yet, tell the user to run
`ideation-discovery`, `greenfield-discovery`, or `brownfield-discovery`
first.

**Note the key is `design`, not `architecture`** -- the produced artifact for
S1 (design-architecture) resolves to the `design` key in `project-config.json`.
An earlier version of this workflow's manifest declared `architecture` and
would have hard-failed `BindRunPaths`; confirm the version you're running
against declares `produces: ["design"]` for S1.

## Step 1 — start the run

```
StartWorkflowRun(workflow="technical-discovery", version="1.0", project=<projectName>,
                  inputs={"scope": <user's scope or reference to the approved
                  spec from the on-ramp workflow>}, rawInvocation=<literal command>,
                  pathContext=<from Step 0>, aiSignal=<...>, gatePolicyJson=<from Step 0>)
```

Report the `gatePlan` before doing any work. **S1 (design-architecture) is
policy-MANDATED** via `gate-policy.json`'s `prompt`-scoped rules -- an
`--approve=` request cannot lower it, and the `gatePlan` will show
`source: "policy-mandate"` on its row regardless of what was requested.
S2–S4 resolve to `always` via the manifest default only, which `--approve=`
*can* lower. Tell the user this distinction up front, not just "everything
is mandated" -- a `--approve=none` request will be partially honoured here,
and discovering that mid-run is worse than hearing it in the gate plan
summary.

## Steps 2–9 — execute S1-S4 inline

For each step (S1-S4):

1. `GetNextRunStep(project, runId)` → fetch directive (includes previous step context)
2. Execute step work inline (ask clarifications via AskUserQuestion as needed)
3. `CompleteRunStep(project, runId, stepId="SN", artifact=<result>)`

If `status: "gate_pending"`, render via `AskUserQuestion` (probe-user contract):
- Approve: `SubmitGateDecision(approve)` → proceed to next step
- Reject: `SubmitGateDecision(reject, feedback=<reason>)` → loop to step (feedback required)
- Skip: `SubmitGateDecision(skip)` → accepts this step's own output, skips the
  step immediately after it, and returns `status: "skip_pending"` naming the
  step after that (or completes the run if none remain)
- Abort: `SubmitGateDecision(abort)` → exit, no handoff

## Responding to skip_pending

`status: "skip_pending"` names a step that has NOT run yet. Ask the user via
`AskUserQuestion` (probe-user contract) whether to proceed, skip it too, or
abort: `SubmitGateDecision(stepId=<named step>, decision="proceed"|"skip"|"abort")`.
Skip cascades one step at a time. If a step's declared dependency was
skipped, the server auto-skips it too without asking (you won't see it in a
`skip_pending` prompt) -- e.g. skipping S3 (create-figma-spec) auto-skips S4
(generate-wireframe), since S4 declares `depends_on: ["S1","S3"]`.

## S2 is conditionally skipped, S3/S4 are not (yet)

- **S2 (design-model)** honors `--design-model=false` server-side -- pass it
  through `rawInvocation` and the engine will skip S2 and its gate entirely.
- **S3 (create-figma-spec) and S4 (generate-wireframe)** declare a
  `content_scan` skip condition ("spec.md contains UI keywords") in the
  manifest, but **the engine does not evaluate `content_scan` conditions** --
  they always run and always gate, UI-relevant scope or not. This is a known,
  documented server-side limitation, not a bug in this orchestrator. If the
  scope is clearly non-UI, tell the user before S3's gate fires so the
  approval prompt for a Figma spec doesn't look like a mistake. Unlike
  before, the correct workaround now is the `skip` decision (see above), not
  `reject` -- `SubmitGateDecision(skip)` at S3's (or an earlier step's) gate
  cleanly skips S3, and S4 is auto-skipped along with it since it depends on
  S3's output.

## Post-approval hooks

Same as `concept-validation.md` Step 5: if a response carries a `hook` object,
run `.propel/hooks/post-approval/post-approval.sh` (or `.ps1`) and pass its
JSON stdout as `mergeReceipt` on the next call for that step. The server will
now refuse to advance past a step whose hook receipt is missing -- confirmed
enforced as of this version, this is not merely advisory.

## Handoff

On `status: "complete"`, hand off into `backlog-agent` per the response's
`handoffTo`. Note `handoffTo` is only ever populated when `status` is
`"complete"` -- an aborted run's response never carries a handoff target.

## Invariants

- Never call `SubmitGateDecision` without an explicit user decision, and
  never with empty `feedback` on a `reject`.
- Never pass an `--approve=` value the user did not type -- and note that for
  this workflow specifically, it only partially matters: S1 is
  policy-mandated and cannot be lowered regardless, but S2–S4 rely on the
  manifest default and CAN be lowered by an `--approve=` request.
- `propel-technical-discovery-s1..s4` subagents must never call
  `SubmitGateDecision` -- they stop at `CompleteRunStep` and return its
  result. Gate handling stays with the parent session.
