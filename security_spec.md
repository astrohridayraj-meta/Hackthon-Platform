# Security Specification & Threat Model

This document outlines the data model invariants, zero-trust security architecture, and adversarial validation ("Dirty Dozen") for the Hackathon Engine.

---

## 1. System Architecture & Zero-Trust Principles

### Zero Client Trust Invariant
Clients (browsers) are treated as completely untrusted environments. In accordance with requirements:
- **No Direct Client Writes**: `allow write: if false;` is enforced across all game entities (`teams`, `tasks`, `ledger`, `antiCheatEvents`, `config`, `adminRubrics`, `leaderboard`).
- **All State Transitions via Server API**: Team lifecycle, task transitions (`LOCKED -> OFFERED -> STARTED -> SUBMITTED | HOPPED`), mode selection, penalties, score calculations, and strike evaluations are executed on the Node.js server using the Firebase Admin SDK.
- **Server Clock Authority**: All timers, round bounds (`roundStart`, `roundEnd`), and away durations (>3s strike threshold) are verified against the server's monotonic clock. Client clocks are strictly for UI countdown display.

### Data Isolation & Access Boundaries
1. **Team Isolation**: A participant may only read the `/teams/{teamId}` document and its subcollections (`tasks`, `ledger`, `antiCheatEvents`) if `request.auth.uid in resource.data.memberIds`. Cross-team eavesdropping is blocked at the rule level.
2. **Admin-Only Rubrics**: The `/adminRubrics/{taskId}` collection containing problem solutions, evaluation keys, and grading rubrics is gated strictly behind `isAdmin()`. Any participant read attempt is rejected with `PERMISSION_DENIED`.
3. **Immutable Ledger**: The `/teams/{teamId}/ledger` collection is append-only and written strictly by the server. Neither participants nor client scripts can modify, truncate, or inject fake ledger entries.

---

## 2. Data Model Invariants

| Collection Path | Entity | Client Read | Client Write | Server Mutation Authority |
| :--- | :--- | :--- | :--- | :--- |
| `/users/{uid}` | User Profile | Self or Admin | `false` | Server auth sync |
| `/admins/{uid}` | Admin Identity | Admin only | `false` | Environment allowlist bootstrap |
| `/config/{configId}` | RoundConfig | All signed-in | `false` | Server Admin API only |
| `/teams/{teamId}` | Team Core State | Member or Admin | `false` | Server state machine endpoints |
| `/teams/{teamId}/tasks/{taskId}` | Task State & Grade | Member or Admin | `false` | Server state machine & Admin grading |
| `/teams/{teamId}/ledger/{id}` | Ledger Entry | Member or Admin | `false` | Server append-only ledger logger |
| `/teams/{teamId}/antiCheatEvents/{id}`| Anti-Cheat Audit | Member or Admin | `false` | Server `/api/anticheat/event` endpoint |
| `/adminRubrics/{taskId}` | Grading Key | Admin only | `false` | Admin setup / seed |
| `/leaderboard/{id}` | Public Standings | All signed-in | `false` | Server leaderboard sync |

---

## 3. The "Dirty Dozen" Adversarial Payloads & Attack Scenarios

The following 12 test payloads represent common real-world exploit vectors in competitive hackathons and how the architecture neutralizes them:

### Attack 1: Client Direct Score Tampering
- **Payload**: `updateDoc(doc(db, "teams", teamId), { score: 99999 })`
- **Result**: `PERMISSION_DENIED`. Firestore rules set `allow write: if false;`. Scores are calculated exclusively from ledger transactions by the server.

### Attack 2: State Shortcut / Direct Status Progression
- **Payload**: `updateDoc(doc(db, "teams", teamId, "tasks", "task_5"), { status: "SUBMITTED", awardedPoints: 100 })`
- **Result**: `PERMISSION_DENIED`. Bypasses `LOCKED -> OFFERED -> STARTED` check; blocked by zero-client-write rules.

### Attack 3: Unauthorized Rubric & Answer Key Extraction
- **Payload**: `getDoc(doc(db, "adminRubrics", "task_1"))` as participant
- **Result**: `PERMISSION_DENIED`. Rules enforce `match /adminRubrics/{taskId} { allow read: if isAdmin(); }`. Non-admins receive an immediate authorization failure.

### Attack 4: Cross-Team Espionage
- **Payload**: `getDoc(doc(db, "teams", "team_rival_123"))`
- **Result**: `PERMISSION_DENIED`. Gated by `request.auth.uid in resource.data.memberIds || isAdmin()`. Unauthorized teams cannot inspect competitors' tasks, variant assignments, or progress.

### Attack 5: Client Timestamp Spoofing for Active Time
- **Payload**: `POST /api/tasks/start` with `{ startedAt: "2026-10-31T00:00:00Z" }`
- **Result**: **Rejected by Server**. The server ignores any client timestamp and stamps `new Date()` from the server clock.

### Attack 6: Submission After Round End (Clock Manipulation)
- **Payload**: `POST /api/tasks/submit` sent after `config.roundEnd` with local client clock wound backward.
- **Result**: **HTTP 403 / State Error**. The server evaluates `new Date() > new Date(config.roundEnd)` and rejects the request with `"Round has concluded"`.

### Attack 7: Anti-Cheat Strike Forgery / Sequence Suppression
- **Payload**: Client suppresses visibility change events or writes `{ strikes: 0, isFlagged: false }` directly to Firestore.
- **Result**: `PERMISSION_DENIED` on direct Firestore write. Furthermore, the server maintains an anti-cheat event sequence log; gaps or abnormal away intervals (>3s) trigger strike penalties and ledger entries.

### Attack 8: Multi-Task Concurrency Abuse
- **Payload**: Team sends concurrent `/api/tasks/start` calls for `task_1` and `task_2` simultaneously.
- **Result**: **Locked by Server Transaction / Mutex**. Server checks `team.currentTaskId != null` inside a Firestore transaction. The second start is rejected with `"Only one task may be STARTED at a time"`.

### Attack 9: Free-Mode Entry Penalty Evasion
- **Payload**: Team switches mode to `FREE` via direct modification without the 50-point penalty.
- **Result**: Cannot write directly to Firestore. When invoking `/api/teams/mode`, the server writes both `team.mode = 'FREE'` and appends a `type: 'FREE_MODE_ENTRY', deltaPoints: -50` ledger record atomically.

### Attack 10: Task Hopping in FREE Mode
- **Payload**: Team in `FREE` mode attempts to call `/api/tasks/hop`.
- **Result**: **HTTP 400 Bad Request**. Server state machine validates `team.mode == 'SEQUENCE'`. Hopping is explicitly forbidden in FREE mode.

### Attack 11: Excessive Variant Swapping
- **Payload**: Team in `OFFERED` status attempts a second `/api/tasks/swap` after having used their single allotted swap.
- **Result**: **HTTP 400 Bad Request**. Server checks `task.swapsUsed >= config.penalties.maxSwapsPerTask` (1) and rejects further swap attempts.

### Attack 12: Admin Impersonation / Self-Role Promotion
- **Payload**: `updateDoc(doc(db, "users", uid), { role: "admin" })` or writing to `/admins/{uid}`.
- **Result**: `PERMISSION_DENIED`. Direct client writes are forbidden. Admins are determined server-side from `ADMIN_EMAILS` env var and trusted `/admins` collection verified by server SDK.

---

## 4. Verification Summary
- **Client Attack Surface**: Fully neutralized. All client SDK writes fail closed (`allow write: if false`).
- **Data Confidentiality**: Strict per-team scoping prevents leakage of team strategies and problem variant assignments.
- **Competitive Integrity**: Answer keys and rubrics are partitioned away from participants.
