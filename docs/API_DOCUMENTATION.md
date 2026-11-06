# Agency OS — Sales Pipeline & Deal Management API Documentation

> **Base URL:** `http://localhost:5001/api`  
> **Auth Scheme:** HTTP Bearer JWT (`Authorization: Bearer <token>`)  
> **Standard Response Format:** All responses are standardized via the global interceptor:
> ```json
> {
>   "success": true,
>   "data": { ... },
>   "meta": { "timestamp": "2026-11-04T12:00:00.000Z" }
> }
> ```

---

## 1. Authentication & Users (`/auth`)

### 1.1 Login
- **Method & Path:** `POST /auth/login`
- **Purpose:** Authenticate user and receive JWT bearer token.
- **Auth Required:** None (Public)
- **Request Body:**
  ```json
  {
    "email": "admin@agency-os.local",
    "password": "Admin@1234"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "cm31abcd0001...",
        "email": "admin@agency-os.local",
        "firstName": "System",
        "lastName": "Admin",
        "role": "ADMIN"
      }
    }
  }
  ```
- **Error Codes:** `400 Bad Request` (Invalid input), `401 Unauthorized` (Invalid credentials)

### 1.2 Get Current User Profile
- **Method & Path:** `GET /auth/me`
- **Purpose:** Retrieve the profile of the authenticated session.
- **Auth Required:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "cm31abcd0001...",
      "email": "admin@agency-os.local",
      "firstName": "System",
      "lastName": "Admin",
      "role": "ADMIN"
    }
  }
  ```

---

## 2. Pipelines & Stages (`/pipelines`)

### 2.1 Get Pipelines
- **Method & Path:** `GET /pipelines`
- **Purpose:** List all configured sales pipelines with ordered stages.
- **Auth Required:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "pipe_default",
        "name": "Standard Sales Pipeline",
        "isDefault": true,
        "stages": [
          { "id": "stg_1", "name": "Lead", "order": 0, "isWon": false, "isLost": false },
          { "id": "stg_2", "name": "Contact Made", "order": 1, "isWon": false, "isLost": false },
          { "id": "stg_3", "name": "Proposal Sent", "order": 2, "isWon": false, "isLost": false },
          { "id": "stg_4", "name": "Negotiation", "order": 3, "isWon": false, "isLost": false },
          { "id": "stg_5", "name": "Closed Won", "order": 4, "isWon": true, "isLost": false },
          { "id": "stg_6", "name": "Closed Lost", "order": 5, "isWon": false, "isLost": true }
        ]
      }
    ]
  }
  ```

---

## 3. Deals Management (`/deals`)

### 3.1 List / Filter Deals
- **Method & Path:** `GET /deals`
- **Purpose:** Query, search, filter, and paginate deals across pipelines.
- **Auth Required:** Bearer Token
- **Query Parameters:**
  - `pipelineId` (string, optional)
  - `state` (`ACTIVE` | `WON` | `LOST` | `ALL`, default `ACTIVE`)
  - `ownerId` (string, optional)
  - `search` (string, search deal name or client name)
  - `stalledOnly` (boolean, filter deals exceeding stalled threshold)
  - `overdueOnly` (boolean, filter deals with past target close date)
  - `page` (number, default 1)
  - `limit` (number, default 20)
  - `sortBy` (`expectedValue` | `createdAt` | `targetCloseDate` | `name`)
  - `sortOrder` (`asc` | `desc`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "deal_123",
          "name": "Acme Corp Web Redesign",
          "expectedValue": 25000,
          "currency": "USD",
          "state": "ACTIVE",
          "stageId": "stg_3",
          "client": { "id": "cli_1", "name": "John Doe", "company": "Acme Corp" },
          "owner": { "id": "usr_1", "firstName": "Sarah", "lastName": "Connor" },
          "intelligence": { "calculatedProbability": 65, "healthScore": 80 }
        }
      ],
      "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
    }
  }
  ```

### 3.2 Create Deal
- **Method & Path:** `POST /deals`
- **Purpose:** Create a new deal with automatic activity logging.
- **Auth Required:** Bearer Token
- **Request Body:**
  ```json
  {
    "name": "Cloud Infrastructure Migration",
    "expectedValue": 45000,
    "currency": "USD",
    "pipelineId": "pipe_default",
    "stageId": "stg_1",
    "clientId": "cli_1",
    "ownerId": "usr_1",
    "targetCloseDate": "2026-12-31T00:00:00.000Z"
  }
  ```
- **Response (201 Created):** Full created deal object.

### 3.3 Get Deal Details
- **Method & Path:** `GET /deals/:id`
- **Purpose:** Retrieve complete deal details, client profile, intelligence, and activities.
- **Auth Required:** Bearer Token
- **Response (200 OK):** Full deal object with relations.

### 3.4 Move Deal Stage (Drag-and-Drop)
- **Method & Path:** `PATCH /deals/:id/stage`
- **Purpose:** Move a deal to a new stage in the kanban board with optimistic UI support.
- **Auth Required:** Bearer Token
- **Request Body:**
  ```json
  {
    "stageId": "stg_4"
  }
  ```
- **Response (200 OK):** Updated deal object with stage transition activity logged.

### 3.5 Mark Deal Lost
- **Method & Path:** `PATCH /deals/:id/lost`
- **Purpose:** Transition deal to LOST state and record the lost reason.
- **Auth Required:** Bearer Token
- **Request Body:**
  ```json
  {
    "lostReason": "Competitor pricing lower by 20%"
  }
  ```

### 3.6 Update Deal
- **Method & Path:** `PATCH /deals/:id`
- **Purpose:** Modify value, owner, close date, or metadata.
- **Auth Required:** Bearer Token

### 3.7 Delete Deal
- **Method & Path:** `DELETE /deals/:id`
- **Purpose:** Remove test deal (restricted by role).
- **Auth Required:** Bearer Token (ADMIN or deal owner)

---

## 4. Dashboard & Intelligence (`/dashboard`)

### 4.1 Get Dashboard Statistics
- **Method & Path:** `GET /dashboard/stats`
- **Purpose:** Fetch KPI summary metrics, active deal counts, won/lost metrics, and currency pipeline breakdown.
- **Auth Required:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "totalActiveDeals": 12,
        "totalWonDeals": 8,
        "totalLostDeals": 2,
        "winRate": 80.0
      },
      "pipelineValueByCurrency": {
        "USD": 385000,
        "EUR": 45000
      },
      "stalledDealsCount": 3,
      "overdueDealsCount": 1
    }
  }
  ```

---

## 5. Follow-Ups & Notifications (`/follow-ups`)

### 5.1 Get Upcoming & Overdue Follow-Ups
- **Method & Path:** `GET /follow-ups`
- **Purpose:** Retrieve scheduled follow-ups for the user's deals.
- **Auth Required:** Bearer Token

### 5.2 Create Follow-Up
- **Method & Path:** `POST /follow-ups`
- **Purpose:** Schedule a task, call, or email reminder for a deal.
- **Request Body:**
  ```json
  {
    "dealId": "deal_123",
    "dueDate": "2026-11-10T10:00:00.000Z",
    "type": "CALL",
    "notes": "Follow up on revised proposal scope"
  }
  ```

---

## 6. Stalled Detection & Win Probability (`/stalled`, `/probability`)

### 6.1 Check Stalled Deals
- **Method & Path:** `GET /stalled-detection`
- **Purpose:** Evaluates deal inactivity against stage-specific SLA thresholds.

### 6.2 Recalculate Win Probability
- **Method & Path:** `POST /probability/evaluate/:dealId`
- **Purpose:** Deterministic scoring algorithm assessing deal value, activity frequency, and stage age.

---

## 7. Project Handoff (`/handoff`)

### 7.1 Initiate Project Handoff
- **Method & Path:** `POST /handoff/:dealId`
- **Purpose:** When a deal is marked CLOSED_WON, triggers handoff to operational delivery with client notes and requirements.

