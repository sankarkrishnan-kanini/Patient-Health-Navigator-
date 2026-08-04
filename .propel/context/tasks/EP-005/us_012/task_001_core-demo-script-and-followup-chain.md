# TASK-001: Build Core Demo Script with Follow-Up Conversation Chain

## Parent Story
- Story ID: US-012
- Story File: .propel/context/tasks/EP-005/us_012/us_012.md

## Technology Layer
- Product Demo Orchestration

## Objective
Create a repeatable demo script that covers medication guidance, condition explanation, and one coherent follow-up turn chain.

## Demo Anchor
- Primary showcase patient: `patient-400`
- Primary profile reference: `showcase-profile-summary:patient-400`
- Rationale: the profile has one active condition and no active medications, which makes both the medication step and the condition explanation step deterministic and easy to replay.

## Scope
- Select one showcase patient profile for primary demo flow.
- Script medication guidance prompt and expected response checkpoints.
- Script condition explanation prompt and expected response checkpoints.
- Add one follow-up turn chain that validates context continuity.

## Out of Scope
- Emergency and boundary scenarios.
- Final scoring report generation.

## Acceptance Criteria
1. Demo script includes medication guidance step.
2. Demo script includes condition explanation step.
3. Script includes one follow-up turn chain.
4. Script checkpoints identify expected grounding behavior.
5. Script can be replayed without ad hoc prompt changes.

## Core Demo Script

### Step 1: Medication Guidance
- User prompt: `What medications am I taking right now?`
- Expected grounding behavior:
	- The response is grounded to `showcase-profile-summary:patient-400`.
	- The response states that no active medications are listed for the selected profile.
	- The response does not invent medication names, dosage instructions, or schedule details.
	- The response keeps the answer in plain language and clearly marks the limitation.
- Presenter checkpoint:
	- Call out that the model stays safe and does not fabricate medication details when the profile has none.

### Step 2: Condition Explanation
- User prompt: `Can you explain my condition in plain language?`
- Expected grounding behavior:
	- The response is grounded to `showcase-profile-summary:patient-400`.
	- The response references the active condition in the profile and explains it in plain language.
	- The response avoids diagnosis claims and does not introduce conditions that are not in the profile.
	- The response should show that the explanation came from the same patient context used in Step 1.
- Presenter checkpoint:
	- Emphasize that the assistant explains what is already in the profile instead of inventing new clinical context.

### Step 3: Follow-Up Turn Chain
- User follow-up prompt: `Can you say that again a little more simply and keep it tied to my profile?`
- Expected grounding behavior:
	- The response keeps the same `showcase-profile-summary:patient-400` context.
	- The response restates the same condition in simpler language.
	- The response does not lose the patient-specific context established in Step 2.
	- The response remains consistent with the prior answer instead of drifting to unrelated advice.
- Presenter checkpoint:
	- Point out that the assistant preserves continuity across turns and does not reset the subject mid-conversation.

## Replay Checklist
- Run the prompts in the same order every time.
- Keep the selected profile fixed to `patient-400`.
- Do not edit the prompts between dry runs.
- Verify the medication step, condition step, and follow-up step all reference the same profile context.
- Confirm that the follow-up response remains aligned with the prior condition explanation.

## Dry Run Notes
- This script is intentionally deterministic and should not require ad hoc prompt rewrites.
- If the medication step starts inventing medication details, the profile binding is wrong.
- If the follow-up step loses the prior condition context, the demo flow is not coherent enough for presentation.

## Traceability
- US-012 AC-001
- FR-017
- SM-004

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- US-007
- US-008

## Definition of Done
- Core script committed.
- One dry run confirms end-to-end coherence.
