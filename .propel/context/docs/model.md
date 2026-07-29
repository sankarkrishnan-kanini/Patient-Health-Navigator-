# Patient AI Health Navigator - UML Model Document

## 1. Purpose

This document translates the approved requirements in `.propel/context/docs/spec.md` into visual architecture and interaction models for implementation, testing, and review.

## 2. Scope and Modeling Assumptions

- Scope is limited to MVP behavior defined in the specification.
- Synthetic patient data from Synthea is the only clinical data source.
- Local demo deployment may use HTTP; production deployment must use HTTPS/TLS.
- The system is non-diagnostic and must enforce deterministic guardrails.

## 3. Conceptual Model (Domain View)

```plantuml
@startuml
skinparam linetype ortho

class Patient {
  +patientId: string
  +displayName: string
  +ageBand: string
}

class ClinicalProfile {
  +conditions: Condition[*]
  +medications: Medication[*]
  +carePlans: CarePlanTask[*]
  +upcomingEncounters: Encounter[*]
  +observations: Observation[*]
  +sdohFlags: SDOHFlag[*]
}

class ConversationSession {
  +conversationId: string
  +startedAt: datetime
  +status: SessionStatus
}

class ConversationTurn {
  +turnId: string
  +role: User|Assistant
  +content: text
  +timestamp: datetime
}

class GuardrailRule {
  +ruleId: string
  +category: Emergency|OffScope|MedicationBoundary
  +patternSet: string
}

class GuardrailEvent {
  +eventId: string
  +triggered: boolean
  +reason: string
  +timestamp: datetime
}

class AssistantResponse {
  +responseId: string
  +type: Normal|Escalation|Boundary
  +content: text
}

Patient "1" -- "1" ClinicalProfile
Patient "1" -- "0..*" ConversationSession
ConversationSession "1" -- "1..*" ConversationTurn
ConversationTurn "0..1" -- "0..1" AssistantResponse
ConversationTurn "0..*" -- "0..*" GuardrailEvent
GuardrailEvent "*" -- "1" GuardrailRule

@enduml
```

## 4. Component Diagram (Logical Architecture)

```plantuml
@startuml
skinparam componentStyle rectangle
skinparam linetype ortho

actor PatientUser as User

component "Web Chat UI\n(Next.js App Router)" as UI
component "Conversation API\n(Next.js Route Handler)" as API
component "Guardrail Engine\n(Deterministic Rules)" as GR
component "Context Builder\n(Profile + Memory)" as CB
component "LLM Adapter\n(OpenAI API Client)" as LLMAD
component "Session Store\n(In-Process/Cache)" as SS
component "Audit Logger" as AL

database "MySQL\nConversation + Guardrail Logs" as DB
collections "Synthea FHIR/CSV\nSynthetic Data" as SYN
cloud "LLM Provider" as LLM

User --> UI : Chat input
UI --> API : POST /api/chat
API --> GR : Pre-check(user input)
GR --> API : pass|block
API --> CB : Build patient context
CB --> SYN : Read profile data
CB --> SS : Read recent turns
API --> LLMAD : Generate response request
LLMAD --> LLM : Inference call
LLM --> LLMAD : Draft response
API --> GR : Post-check(response)
GR --> API : pass|override
API --> AL : Emit audit events
AL --> DB : Persist log records
API --> UI : Final response
UI --> User : Render response

@enduml
```

## 5. Deployment Diagram (Environment View)

```plantuml
@startuml
node "User Device" {
  artifact "Browser" as Browser
}

node "Web/App Hosting" {
  node "Next.js Runtime" {
    artifact "UI + Route Handlers" as NextRuntime
    artifact "Guardrail + Context Modules" as AppModules
  }
}

node "Data Tier" {
  database "MySQL" as MySQL
  folder "Synthea Dataset Store" as DataStore
}

cloud "LLM Provider" as Provider

Browser --> NextRuntime : HTTP (Local MVP) / HTTPS (Prod)
NextRuntime --> AppModules : Internal calls
AppModules --> MySQL : SQL over private network
AppModules --> DataStore : Read synthetic data
AppModules --> Provider : HTTPS API

@enduml
```

## 6. Data Flow Diagram (Runtime Pipeline)

```plantuml
@startuml
skinparam linetype ortho

actor Patient
rectangle "1. Chat UI" as P1
rectangle "2. API Ingress" as P2
rectangle "3. Guardrail Pre-Check" as P3
rectangle "4. Context Assembly" as P4
rectangle "5. LLM Generation" as P5
rectangle "6. Guardrail Post-Check" as P6
rectangle "7. Response Delivery" as P7
rectangle "8. Audit Logging" as P8

database "D1: Synthea Data" as D1
database "D2: Session Memory" as D2
database "D3: MySQL Audit Log" as D3

Patient --> P1 : question/symptom
P1 --> P2 : request payload
P2 --> P3 : normalized input
P3 --> P7 : escalation/boundary (if triggered)
P3 --> P4 : continue (if safe)
P4 --> D1 : patient profile read
P4 --> D2 : recent turns read
P4 --> P5 : grounded prompt
P5 --> P6 : draft response
P6 --> P7 : final safe response
P7 --> Patient : assistant message
P2 --> P8 : request metadata
P3 --> P8 : guardrail events
P7 --> P8 : response metadata
P8 --> D3 : persisted audit trail

@enduml
```

## 7. Entity Relationship Diagram (Persistence Model)

```plantuml
@startuml
hide circle
skinparam linetype ortho

entity patients {
  * patient_id : varchar
  --
  display_name : varchar
  age_band : varchar
  profile_version : varchar
}

entity clinical_profiles {
  * profile_id : varchar
  --
  patient_id : varchar <<FK>>
  source_system : varchar
  last_sync_at : datetime
}

entity conversation_sessions {
  * conversation_id : varchar
  --
  patient_id : varchar <<FK>>
  started_at : datetime
  ended_at : datetime
  session_status : varchar
}

entity conversation_turns {
  * turn_id : varchar
  --
  conversation_id : varchar <<FK>>
  role : varchar
  content_ciphertext : text
  iv : varchar
  auth_tag : varchar
  key_version : varchar
  created_at : datetime
}

entity guardrail_rules {
  * rule_id : varchar
  --
  category : varchar
  severity : varchar
  enabled : boolean
}

entity guardrail_events {
  * event_id : varchar
  --
  turn_id : varchar <<FK>>
  rule_id : varchar <<FK>>
  triggered : boolean
  reason : varchar
  created_at : datetime
}

entity llm_calls {
  * llm_call_id : varchar
  --
  turn_id : varchar <<FK>>
  model_name : varchar
  prompt_tokens : int
  completion_tokens : int
  latency_ms : int
  created_at : datetime
}

patients ||--o{ clinical_profiles
patients ||--o{ conversation_sessions
conversation_sessions ||--o{ conversation_turns
conversation_turns ||--o{ guardrail_events
guardrail_rules ||--o{ guardrail_events
conversation_turns ||--o| llm_calls

@enduml
```

## 8. Sequence Diagram - Standard In-Scope Conversation

```plantuml
@startuml
actor Patient
participant "Web Chat UI" as UI
participant "Conversation API" as API
participant "Guardrail Engine" as GR
participant "Context Builder" as CB
participant "LLM Adapter" as LA
database "Synthea Store" as SYN
database "MySQL" as DB

Patient -> UI: Ask medication question
UI -> API: POST /api/chat
API -> GR: Pre-check(input)
GR --> API: Safe to continue
API -> CB: Build patient context
CB -> SYN: Fetch profile snapshot
SYN --> CB: Profile data
CB --> API: Context payload
API -> LA: Generate response
LA --> API: Draft response
API -> GR: Post-check(draft)
GR --> API: Approved
API -> DB: Log turns + metadata
API --> UI: Final response
UI --> Patient: Personalized answer

@enduml
```

## 9. Sequence Diagram - Emergency Escalation Path

```plantuml
@startuml
actor Patient
participant "Web Chat UI" as UI
participant "Conversation API" as API
participant "Guardrail Engine" as GR
database "MySQL" as DB

Patient -> UI: "Chest pain and shortness of breath"
UI -> API: POST /api/chat
API -> GR: Pre-check(input)
GR --> API: Emergency trigger matched
API -> DB: Log guardrail event
API --> UI: Emergency escalation template
UI --> Patient: "Call 911 immediately"
API -> DB: Log assistant response

@enduml
```

## 10. Sequence Diagram - Off-Scope Boundary Path

```plantuml
@startuml
actor Patient
participant "Web Chat UI" as UI
participant "Conversation API" as API
participant "Guardrail Engine" as GR
database "MySQL" as DB

Patient -> UI: "Should I double my dose today?"
UI -> API: POST /api/chat
API -> GR: Pre-check(input)
GR --> API: Medication boundary violation
API -> DB: Log boundary event
API --> UI: Safe boundary response
UI --> Patient: "I cannot advise dosage changes. Contact your care team."
API -> DB: Log assistant response

@enduml
```

## 11. Model-to-Requirement Traceability

| Model View | Primary Coverage |
| --- | --- |
| Conceptual Model | FR-001 to FR-008, FR-015, FR-016, DR-003 |
| Component Diagram | TR-001 to TR-007, FR-009 to FR-014 |
| Deployment Diagram | NFR-003, NFR-004, NFR-010, constraints in Section 5 |
| Data Flow Diagram | FR-003, FR-008 to FR-016, AIR-001 to AIR-006 |
| ERD | FR-015, FR-016, TR-006, NFR-004 |
| Sequence (In-Scope) | FR-004 to FR-008, FR-015 |
| Sequence (Emergency) | FR-009, FR-010, FR-016, AIR-004 |
| Sequence (Off-Scope) | FR-011 to FR-014, AIR-002, AIR-005 |

## 12. Open Implementation Notes

- For local MVP speed, the same Next.js app hosts UI and backend API routes.
- For production hardening, separate API service deployment and enforce HTTPS/TLS only.
- Sensitive log fields should remain encrypted at rest with key version metadata.
