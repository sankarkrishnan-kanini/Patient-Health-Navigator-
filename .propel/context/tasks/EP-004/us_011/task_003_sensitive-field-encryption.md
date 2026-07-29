# TASK-003: Encrypt Sensitive Audit Fields with Key Versioning

## Parent Story
- Story ID: US-011
- Story File: .propel/context/tasks/EP-004/us_011/us_011.md

## Technology Layer
- Security and Data Protection

## Objective
Encrypt sensitive audit content fields and persist key version metadata for controlled decryption and rotation.

## Scope
- Identify sensitive fields for encryption at rest.
- Implement field-level encryption utility usage in audit write path.
- Store key version metadata per encrypted record.
- Add decrypt-read helper for authorized diagnostic workflows.

## Out of Scope
- Enterprise key vault provisioning.
- Full cryptographic policy management.

## Acceptance Criteria
1. Sensitive log fields are encrypted before persistence.
2. Key version metadata is stored with encrypted fields.
3. Non-sensitive fields remain queryable without decryption.
4. Encryption failures block writes with explicit error.
5. Test cases validate encrypt/decrypt roundtrip and version metadata.

## Traceability
- US-011 AC-003
- NFR-004
- TR-006

## Effort
- Estimate: 6 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-001

## Definition of Done
- Encryption path committed and verified.
- Key-versioned records inspected in storage.
