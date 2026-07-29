# TASK-002: Apply Clinical Diversity Rules for Demo Cohort

## Parent Story
- Story ID: US-004
- Story File: .propel/context/tasks/EP-DATA-001/us_004/us_004.md

## Technology Layer
- Data Quality and Scenario Coverage

## Objective
Ensure selected profiles represent varied clinical contexts (chronic, preventive, and symptom-oriented scenarios).

## Scope
- Define diversity rule set for clinical variety.
- Tag candidate profiles by scenario category.
- Enforce minimum spread across categories during final selection.
- Generate diversity coverage report.

## Out of Scope
- Deep domain phenotype modeling.
- Automated risk scoring.

## Acceptance Criteria
1. Cohort includes varied contexts such as chronic disease and preventive care.
2. Coverage report lists category distribution across selected profiles.
3. No single category dominates cohort unless explicitly configured.
4. Rule violations are flagged before finalizing cohort.
5. Diversity checks are repeatable for refresh runs.

## Traceability
- US-004 AC-002
- DR-002
- DR-003

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001

## Definition of Done
- Diversity rule module committed.
- Cohort diversity report validated once.
