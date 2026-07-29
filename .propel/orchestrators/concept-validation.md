# concept-validation

Composite agent: brainstorm candidate concepts, select one, build a throwaway
prototype, then hand off into `technical-discovery`. Unlike a bare `ReadWorkflow`
orchestrator, this one is gate-ENFORCED server-side: `GetNextRunStep` refuses
to return a directive while a gate is pending, so the steps below cannot be
skipped by proceeding anyway.

## Step 0 — resolve paths and policy

```
/artifact-resolver brainstorm
/artifact-resolver prototype
```

Build `pathContext` from the two results:

```json
{
  "brainstorm": {"path": "<propelFilePath>", "content_type": "<contentType>", "mcp_type": "<mcpType>"},
  "prototype":  {"path": "<propelFilePath>", "content_type": "<contentType>", "mcp_type": "<mcpType>"}
}
```

Read `.propel/gate-policy.json` and pass its raw content as `gatePolicyJson`
on every call below. The server never reads this file itself.

## Step 1 — start the run

Call MCP tool:
```
StartWorkflowRun(workflow="concept-validation", version="1.0", project=<projectName from project-config.json>,
                  inputs={"scope": <user's scope>}, rawInvocation=<the literal command as typed>,
                  pathContext=<from Step 0>, aiSignal=<true if scope carries [AI-CANDIDATE]/[HYBRID]>,
                  gatePolicyJson=<from Step 0>)
```

Update the ToDo list from the returned `directive`. Report the `gatePlan` to
the user before doing any work — if a row carries a `note`, their `--approve=`
request was clamped by a mandate; say so and give the `reason`. Never let them
discover a gate by hitting it.

## Step 2 — execute S1 (brainstorm-idea)

**Session isolation.** Brainstorming explores multiple candidates and can
generate substantial back-and-forth -- keep it out of this orchestrator's own
context. **The mechanism is host-specific and lives in your shim, not here**:
`.claude/commands/concept-validation.md` (Claude Code), `.github/prompts/concept-validation.prompt.md`
(Copilot), or `.windsurf/workflows/concept-validation.md` (Windsurf) --
whichever matches your current host. This file is identical across all
three, and a delegation mechanism only some hosts can actually use shouldn't
sit in the copy the others read too. Follow your shim's instructions for S1
before proceeding.

Either way, once S1 is complete, the parent receives:
```
CompleteRunStep(project, runId, stepId="S1",
  envelope={"artifacts": [<brainstorm propelFilePath>],
            "candidates": [{"id": "C-001", "title": "...", "score": 8.4}, ...],
            "openQuestions": [...]},
  gatePolicyJson=<from Step 0>)
```
(the subagent calls this itself and hands back the result; on Windsurf, the
resumed session calls it directly.)

## Step 3 — gate (selection)

`status: "gate_pending"` means STOP. Render the returned `gate` payload using
`AskUserQuestion` per the rendering contract in `.propel/skills/probe-user/SKILL.md`
(one question, first option recommended, exactly 4 options total, Custom last).
Map each candidate to an option; if more than 3 candidates were produced,
present the top 3 by score plus Custom, and mention the rest are available on
request. Do not present raw JSON.

Then:
```
SubmitGateDecision(project, runId, stepId="S1", decision="select",
  selection=[<chosen candidate id>], gatePolicyJson=<from Step 0>)
```

`reject` loops back to S1 with feedback injected; it does not fail the run.

## Step 4 — execute S2 (build-prototype)

Same isolation rule as Step 2, and the same pointer -- **follow your host's
shim** for the exact delegation mechanism, this file stays host-agnostic. The
subagent (or resumed Windsurf session) needs the selected candidate from
`context.selected` on the S1 result, in addition to `runId`/`project`/`gatePolicyJson`.

Either way, once S2 is complete, the parent receives:
```
CompleteRunStep(project, runId, stepId="S2",
  envelope={"artifacts": [<prototype propelFilePath>], "facts": {"eval.verdict": "<verdict>"}},
  gatePolicyJson=<from Step 0>)
```

A `PASS` verdict on this step auto-approves (S2's gate is conditional, not
mandated) and the run completes without a human pause. Any other verdict, or
`--approve=` requesting one, raises the gate — go to Step 3's rendering
approach, but this gate is `user_approval` type: present the artifact and the
`basis`, offer approve / reject / abort.

## Step 5 — post-approval hook

If the response from Step 2 or Step 4 carries a `hook` object, run:
```
AUTO_MERGE=<hook.autoMerge> BASE=<hook.base> \
  bash .propel/hooks/post-approval/post-approval.sh <hook.args...> <hook.artifacts...>
```
(use `post-approval.ps1` on Windows). Its JSON stdout is the `mergeReceipt` —
only needed if a subsequent `SubmitGateDecision` call for the same step
requires it.

## Step 6 — handoff

On `status: "complete"`, the response carries `handoffTo: "technical-discovery"`.
Tell the user the selected concept is ready and offer to start `technical-discovery`
(its S1 = `/create-spec`, which will consult the approved `prototype` and
`brainstorm` artifacts per `spec`'s `references` in `project-config.json`).
`technical-discovery` is itself gate-enforced -- see `orchestrators/technical-discovery.md`
-- so starting it means calling `StartWorkflowRun(workflow="technical-discovery", ...)`,
not the bare `ReadWorkflow` some older orchestrators still use.

## Invariants

- Never call `SubmitGateDecision` without an explicit user decision.
- Never pass an `--approve=` value the user did not type.
- Never call `GetNextRunStep` as a way to skip past a pending gate — it will
  refuse and return an error naming the step that needs a decision.
- `propel-concept-validation-s1`/`propel-concept-validation-s2` subagents must never call
  `SubmitGateDecision` — they have no interactive turn with the user, so a
  gate raised inside a subagent is unsatisfiable. They stop at
  `CompleteRunStep` and return its result; gate handling stays with the
  parent session that invoked them.
