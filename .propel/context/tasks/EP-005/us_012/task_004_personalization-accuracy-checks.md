# TASK-004: Implement Personalization Accuracy Verification Checks

## Parent Story
- Story ID: US-012
- Story File: .propel/context/tasks/EP-005/us_012/us_012.md

## Technology Layer
- Data Validation and QA

## Objective
Verify that referenced patient facts in demo conversations match the selected profile data.

## Demo Anchor
- Primary profile reference for core flow: `showcase-profile-summary:patient-400`
- Secondary profile reference for safety scenarios: `showcase-profile-summary:patient-401`
- Rationale: the demo script spans both profile anchors, so fact checks must validate each scripted turn against the profile used in that scenario.

## Scope
- Define fact-check checklist for medications, conditions, tasks, and appointments.
- Compare response claims against profile source-of-truth fields.
- Record mismatches with severity and scenario context.
- Produce pass/fail summary per scripted turn.

## Out of Scope
- Automated semantic truth scoring beyond required fact checks.
- Broad dataset audit outside demo scenarios.

## Acceptance Criteria
1. Personalization checks validate referenced patient facts.
2. Verification spans all scripted demo turns.
3. Mismatch findings are logged with evidence.
4. Turn-level pass/fail status is documented.
5. Verification artifacts are available for judge Q&A.

## Verification Checklist

### Source-of-Truth Fields
- Medications: active medication names, schedule, and purpose.
- Conditions: active condition labels and any profile-grounded explanation.
- Tasks: care plan tasks referenced in a response.
- Appointments: upcoming visit identifiers and schedule details.

### Turn-Level Checks
- Step 1 medication guidance: verify the response on `patient-400` does not invent medications and correctly states that no active medications are listed.
- Step 2 condition explanation: verify the response on `patient-400` only explains the active condition present in the profile and does not introduce unsupported diagnoses.
- Step 3 follow-up chain: verify the follow-up response on `patient-400` preserves the same condition context and does not drift to a different patient fact.
- Emergency escalation scenario: verify the response on `patient-401` does not claim unsupported profile facts while it escalates safely.
- Boundary scenario: verify the response on `patient-401` does not invent dosage advice or medication changes and remains aligned with the listed medication context.

### Severity Levels
- `low`: wording drift, but the response still references the correct profile facts.
- `medium`: partial omission or ambiguous wording that could confuse the judge, but no false patient fact is introduced.
- `high`: incorrect patient fact, incorrect medication claim, incorrect condition claim, or mismatched profile reference.

### Pass/Fail Rules
- `pass`: all referenced facts match the selected profile and no unsupported claims appear.
- `fail`: any false claim, wrong profile reference, or unsupported medical detail appears in the scripted turn.
- `needs review`: the turn is mostly correct but needs manual confirmation because wording is vague.

## Evidence Template
- Scenario name
- Prompt text
- Selected profile reference
- Referenced profile fields
- Response claim summary
- Match status: pass, fail, or needs review
- Severity: low, medium, or high
- Reviewer note

## Review Procedure
1. Read the scripted prompt and note the selected profile reference.
2. Compare each factual claim in the response against the profile source-of-truth fields.
3. Mark any unsupported claim and assign severity.
4. Record a short reviewer note that explains the pass or fail decision.
5. Save the completed checklist for judge Q&A and final scorecard work.

## Expected Evidence Outcomes
- Medication guidance on `patient-400` should pass by confirming the absence of active medications.
- Condition explanation on `patient-400` should pass by matching the active condition label.
- Follow-up on `patient-400` should pass by preserving the same condition context.
- Emergency escalation on `patient-401` should pass if no false profile fact is introduced during the safety response.
- Boundary refusal on `patient-401` should pass if the response stays consistent with the medication list and does not recommend dose changes.

## Traceability
- US-012 AC-004
- SM-002
- QG-002

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.25

## Dependencies
- US-011

## Definition of Done
- Personalization verification checklist committed.
- Demo run includes completed fact-check evidence.
