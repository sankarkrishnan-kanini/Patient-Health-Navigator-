# Design Modelling

## UML Models Overview
This document translates requirements in `.propel/context/docs/spec.md` and
architecture decisions in `.propel/context/docs/design.md` into executable text
models. It provides system boundary, component, deployment, data flow, data
structure, and per-use-case runtime interaction views to support implementation,
review, and onboarding.

## Architectural Views

### System Context Diagram
```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Player" as Player #LightBlue
component "Court Availability Provider" as CAP #LightGray
component "Notification Service" as Notify #LightGray

rectangle "Badminton Matching System" #LightGreen {
  component "Web/Mobile Client" as Client
  component "Submission API" as API
  component "Matching Core" as MatchCore
}

database "Operational DB" as DB #Yellow

Player --> Client : HTTPS / REST\nSubmit preferences
Client --> API : HTTPS / REST\nCreate request
API --> MatchCore : Internal call\nQueue match process
MatchCore --> CAP : HTTPS / REST\nCheck court slots
MatchCore --> DB : SQL\nRead/Write decisions
MatchCore ..> Notify : Async event\nOutcome notification
Notify --> Player : Push/Email\nMatch outcome
@enduml
```

### Component Architecture Diagram
```mermaid
graph LR
  Player[Player Client]:::actor --> UI[Web UI Module]:::core
  UI --> SubmissionAPI[Submission API]:::core
  SubmissionAPI --> ValidationSvc[Validation Service]:::core
  SubmissionAPI --> RequestRepo[(Request Store)]:::data

  SubmissionAPI --> MatchOrchestrator[Match Orchestrator]:::core
  MatchOrchestrator --> AllocationEngine[Allocation Engine]:::core
  MatchOrchestrator --> PartnerMatcher[Partner Matcher]:::core
  MatchOrchestrator --> AlternativeEngine[Alternative Engine]:::core

  AllocationEngine --> CourtAdapter[Court Availability Adapter]:::external
  AllocationEngine --> RequestRepo
  PartnerMatcher --> RequestRepo
  AlternativeEngine --> RequestRepo
  MatchOrchestrator --> DecisionRepo[(Decision Store)]:::data
  MatchOrchestrator -.-> NotificationAdapter[Notification Adapter]:::external

  classDef actor fill:#add8e6
  classDef core fill:#90ee90
  classDef data fill:#ffffe0
  classDef external fill:#d3d3d3
```

### Deployment Architecture Diagram
```plantuml
@startuml
left to right direction
skinparam linetype ortho

cloud "Internet" as Internet
node "Hub VNet\nShared Services" as Hub {
  node "WAF + API Gateway" as Gateway
  node "Identity Provider" as IdP
  node "Monitoring Stack" as Monitor
}

node "Workload VNet\nKubernetes Cluster" as Workload {
  node "Frontend Pod" as Frontend
  node "API Pod" as ApiPod
  node "Worker Pod" as Worker
}

database "Managed PostgreSQL" as Pg
node "Managed Redis" as Redis
cloud "Court Provider API" as CourtApi
cloud "Notification Provider" as NotifyApi

Internet --> Gateway : HTTPS
Gateway --> Frontend : Routed traffic
Gateway --> ApiPod : API traffic
ApiPod --> IdP : OIDC token validation
ApiPod --> Pg : SQL/TLS
ApiPod --> Redis : Cache/Queue
Worker --> Pg : SQL/TLS
Worker --> Redis : Queue operations
Worker --> CourtApi : HTTPS
Worker --> NotifyApi : HTTPS
ApiPod --> Monitor : Metrics/Logs/Traces
Worker --> Monitor : Metrics/Logs/Traces
@enduml
```

### Data Flow Diagram
```plantuml
@startuml
left to right direction
!define PROCESS rectangle
!define DATASTORE database
!define EXTERNAL component

EXTERNAL "Player" as player
EXTERNAL "Court Availability Provider" as courtApi
PROCESS "Submit Availability" as p1
PROCESS "Validate Request" as p2
PROCESS "Aggregate + Match" as p3
PROCESS "Allocate Slot" as p4
PROCESS "Generate Alternatives" as p5
PROCESS "Publish Outcome" as p6
DATASTORE "Request Store" as ds1
DATASTORE "Decision Store" as ds2

player -> p1 : Date/time/location/preferences
p1 -> p2 : Raw request
p2 -> ds1 : Persist valid request
ds1 -> p3 : Grouped requests
p3 -> p4 : Candidate groups
p4 -> courtApi : Check slot availability
courtApi -> p4 : Availability response
p4 -> ds2 : Allocation decision
p4 -> p5 : If unavailable
p5 -> ds2 : Alternatives
ds2 -> p6 : Final outcome payload
p6 -> player : Confirmed slot or options
@enduml
```

### Logical Data Model (ERD)
```mermaid
erDiagram
  PLAYER ||--o{ AVAILABILITY_REQUEST : submits
  COURT ||--o{ COURT_SLOT : provides
  AVAILABILITY_REQUEST }o--o{ MATCH_GROUP : grouped_into
  MATCH_GROUP ||--o{ PARTNER_ASSIGNMENT : forms
  MATCH_GROUP ||--|| ALLOCATION_DECISION : yields
  ALLOCATION_DECISION ||--o{ ALTERNATIVE_RECOMMENDATION : suggests
  COURT_SLOT ||--o{ ALLOCATION_DECISION : allocated_to

  PLAYER {
    uuid player_id PK
    string display_name
    string skill_level
    string home_location
    datetime created_at
  }

  AVAILABILITY_REQUEST {
    uuid request_id PK
    uuid player_id FK
    date play_date
    string preferred_time_slot
    string preferred_location
    boolean needs_partner
    boolean open_to_alternatives
    datetime submitted_at
    string status
  }

  COURT {
    uuid court_id PK
    string facility_name
    string geo_location
    int capacity
    boolean is_active
  }

  COURT_SLOT {
    uuid slot_id PK
    uuid court_id FK
    date slot_date
    string time_window
    string slot_status
  }

  MATCH_GROUP {
    uuid group_id PK
    date match_date
    string location_bucket
    string time_bucket
    int player_count
  }

  PARTNER_ASSIGNMENT {
    uuid assignment_id PK
    uuid group_id FK
    uuid player_a_id FK
    uuid player_b_id FK
    string compatibility_reason
  }

  ALLOCATION_DECISION {
    uuid decision_id PK
    uuid group_id FK
    uuid slot_id FK
    string policy_version
    string decision_status
    datetime decided_at
  }

  ALTERNATIVE_RECOMMENDATION {
    uuid recommendation_id PK
    uuid decision_id FK
    string recommendation_type
    string recommendation_value
    int rank_order
  }
```

### Use Case Sequence Diagrams

#### UC-001: Submit Availability and Preferences
**Source**: [spec.md#UC-001](.propel/context/docs/spec.md#UC-001)

```mermaid
sequenceDiagram
    participant Player as User (Player)
    participant UI as Web UI
    participant API as Submission API
    participant Validation as Validation Service
    participant DB as Request Store

    Note over Player,DB: UC-001 - Submit Availability and Preferences

    Player->>UI: Open form and enter availability
    UI->>API: POST /availability-requests
    API->>Validation: Validate required date and fields
    Validation-->>API: Validation result
    API->>DB: Persist valid request
    DB-->>API: Request ID and status
    API-->>UI: 202 Accepted with tracking info
    UI-->>Player: Submission confirmation
```

```plantuml
@startuml sequence
actor "User (Player)" as Player
participant "Submission API" as API
participant "Validation Service" as Validation
database "Request Store" as DB

Player -> API : Submit availability request
API -> Validation : Validate payload
Validation --> API : Validation result
API -> DB : Insert request
DB --> API : request_id
API --> Player : Submission acknowledged
@enduml
```

#### UC-002: Match and Allocate Court Slot
**Source**: [spec.md#UC-002](.propel/context/docs/spec.md#UC-002)

```mermaid
sequenceDiagram
    participant Scheduler as Match Worker
    participant Match as Match Orchestrator
    participant Court as Court Availability Adapter
    participant Repo as Request Store
    participant Decision as Decision Store

    Note over Scheduler,Decision: UC-002 - Match and Allocate Court Slot

    Scheduler->>Match: Trigger matching batch by date/time/location
    Match->>Repo: Load grouped requests
    Repo-->>Match: Candidate groups
    Match->>Court: Check requested slot availability
    Court-->>Match: Available/unavailable slots
    Match->>Match: Apply allocation policy + minimum players
    Match->>Match: Run partner matching for opted-in users
    Match->>Decision: Save confirmed slot or pending outcome
    Decision-->>Scheduler: Decision persisted
```

```plantuml
@startuml sequence
actor "Match Worker" as Worker
participant "Match Orchestrator" as Match
participant "Court Adapter" as Court
database "Request Store" as ReqDB
database "Decision Store" as DecDB

Worker -> Match : Start batch match
Match -> ReqDB : Read grouped requests
ReqDB --> Match : Candidate groups
Match -> Court : Query slot availability
Court --> Match : Availability result
Match -> Match : Allocate and partner match
Match -> DecDB : Persist allocation decision
DecDB --> Worker : Decision status
@enduml
```

#### UC-003: Provide Alternatives and Final Outcome
**Source**: [spec.md#UC-003](.propel/context/docs/spec.md#UC-003)

```mermaid
sequenceDiagram
    participant Player as User (Player)
    participant API as Outcome API
    participant Alt as Alternative Engine
    participant Repo as Decision Store
    participant Notify as Notification Adapter

    Note over Player,Notify: UC-003 - Provide Alternatives and Final Outcome

    Player->>API: Request match result
    API->>Repo: Fetch allocation decision
    Repo-->>API: Primary outcome
    API->>Alt: Generate alternatives if unavailable and allowed
    Alt-->>API: Ranked alternatives
    API->>Notify: Publish final outcome message
    Notify-->>Player: Confirmed slot or alternatives
```

```plantuml
@startuml sequence
actor "User (Player)" as Player
participant "Outcome API" as API
participant "Alternative Engine" as Alt
database "Decision Store" as DecDB
participant "Notification Adapter" as Notify

Player -> API : Request final outcome
API -> DecDB : Read decision
DecDB --> API : Decision payload
API -> Alt : Compute alternatives
Alt --> API : Ranked options
API -> Notify : Send final message
Notify --> Player : Outcome notification
@enduml
```
