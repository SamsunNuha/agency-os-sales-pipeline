# Database Schema — Agency OS Sales Pipeline

## 1. Overview

- **Database**: PostgreSQL 15
- **ORM**: Prisma 5
- **Naming**: `snake_case` for column names, `PascalCase` for Prisma model names
- **Timestamps**: All tables include `createdAt` and `updatedAt`
- **Monetary values**: Stored as `Decimal(15,2)` — never `Float`
- **Currency codes**: ISO 4217 (`USD`, `EUR`, `GBP`, `INR`, etc.)
- **Multi-tenancy**: All business entities carry an `agencyId` FK

---

## 2. Entity Relationship Diagram

```
Agency
  ├── User (many)
  │     └── Role (many-to-many)
  ├── Client (many)
  ├── SalesPipeline (many)
  │     └── PipelineStage (many, ordered)
  └── Deal (many)
        ├── Client (FK)
        ├── User owner (FK)
        ├── SalesPipeline (FK)
        ├── PipelineStage (FK)
        ├── DealStageHistory (many)
        ├── DealFollowUp (many)
        ├── DealActivity (many)
        └── DealIntelligence (one)
```

---

## 3. Models

### Agency

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | NOT NULL |
| slug | String | UNIQUE |
| isActive | Boolean | DEFAULT true |
| createdAt | DateTime | AUTO |
| updatedAt | DateTime | AUTO |

---

### User

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agencyId | UUID | FK → Agency |
| email | String | UNIQUE |
| passwordHash | String | bcrypt hash |
| firstName | String | |
| lastName | String | |
| isActive | Boolean | DEFAULT true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Role

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agencyId | UUID | FK → Agency |
| name | String | e.g. ADMIN, SALES_MANAGER, SALES_REP |
| permissions | String[] | e.g. ["deal:create","deal:read"] |

---

### Client

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agencyId | UUID | FK → Agency |
| name | String | |
| email | String | NULLABLE |
| phone | String | NULLABLE |
| company | String | NULLABLE |
| isActive | Boolean | DEFAULT true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### SalesPipeline

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agencyId | UUID | FK → Agency |
| name | String | |
| description | String | NULLABLE |
| isActive | Boolean | DEFAULT true |
| isDefault | Boolean | DEFAULT false |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### PipelineStage

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| pipelineId | UUID | FK → SalesPipeline |
| agencyId | UUID | FK → Agency |
| name | String | |
| slug | String | Stable identifier |
| order | Int | Display order |
| probability | Int | Default probability % for this stage |
| isWon | Boolean | DEFAULT false |
| isLost | Boolean | DEFAULT false |
| color | String | Hex color |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Unique:** `(pipelineId, slug)`, `(pipelineId, order)`

---

### Deal

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agencyId | UUID | FK → Agency |
| clientId | UUID | FK → Client |
| title | String | NOT NULL |
| description | String | NULLABLE |
| serviceCategory | String | e.g. "Web Development" |
| expectedValue | Decimal(15,2) | NOT NULL |
| currency | String(3) | ISO 4217 |
| ownerId | UUID | FK → User |
| pipelineId | UUID | FK → SalesPipeline |
| stageId | UUID | FK → PipelineStage |
| expectedCloseDate | DateTime | |
| state | DealState | ACTIVE \| WON \| LOST \| ARCHIVED |
| manualProbability | Int | NULLABLE (0-100) |
| notes | String | NULLABLE |
| tags | String[] | |
| source | String | NULLABLE |
| wonAt | DateTime | NULLABLE |
| lostAt | DateTime | NULLABLE |
| lostReason | String | NULLABLE |
| lostNote | String | NULLABLE |
| archivedAt | DateTime | NULLABLE |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Enum DealState:** `ACTIVE`, `WON`, `LOST`, `ARCHIVED`

---

### DealStageHistory

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| dealId | UUID | FK → Deal |
| agencyId | UUID | FK → Agency |
| fromStageId | UUID | NULLABLE FK → PipelineStage |
| toStageId | UUID | FK → PipelineStage |
| movedById | UUID | FK → User |
| note | String | NULLABLE |
| createdAt | DateTime | |

---

### DealFollowUp

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| dealId | UUID | FK → Deal |
| agencyId | UUID | FK → Agency |
| scheduledAt | DateTime | |
| completedAt | DateTime | NULLABLE |
| rescheduledAt | DateTime | NULLABLE |
| note | String | |
| status | FollowUpStatus | UPCOMING \| OVERDUE \| COMPLETED \| RESCHEDULED |
| createdById | UUID | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### DealActivity

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| dealId | UUID | FK → Deal |
| agencyId | UUID | FK → Agency |
| activityType | ActivityType | STAGE_CHANGE \| NOTE_ADDED \| FOLLOW_UP_SCHEDULED \| FOLLOW_UP_COMPLETED \| DEAL_WON \| DEAL_LOST \| DEAL_CREATED \| PROBABILITY_UPDATED |
| description | String | Human-readable event description |
| metadata | Json | Extra structured data |
| performedById | UUID | FK → User |
| createdAt | DateTime | |

---

### DealIntelligence

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| dealId | UUID | UNIQUE FK → Deal |
| agencyId | UUID | FK → Agency |
| calculatedProbability | Int | 0–100 |
| probabilitySignals | Json | Explanation factors |
| calculationVersion | String | e.g. "v1.0-rule-based" |
| isStalled | Boolean | DEFAULT false |
| stalledAt | DateTime | NULLABLE |
| inactiveDays | Int | Computed |
| lastActivityAt | DateTime | NULLABLE |
| stalledReason | String | NULLABLE |
| recalculatedAt | DateTime | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## 4. Indexes

| Table | Index |
|-------|-------|
| Deal | `agencyId`, `stageId`, `pipelineId`, `ownerId`, `clientId`, `state`, `expectedCloseDate` |
| DealStageHistory | `dealId`, `agencyId` |
| DealFollowUp | `dealId`, `agencyId`, `scheduledAt`, `status` |
| DealActivity | `dealId`, `agencyId`, `activityType` |
| DealIntelligence | `dealId` (UNIQUE), `agencyId`, `isStalled` |
| PipelineStage | `pipelineId`, `agencyId` |
| User | `agencyId`, `email` (UNIQUE) |
| Client | `agencyId` |

---

## 5. Migration Commands

```bash
# Run all pending migrations
npx prisma migrate dev

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production (no schema changes)
npx prisma migrate deploy

# Reset database (DESTRUCTIVE — dev only)
npx prisma migrate reset

# Regenerate Prisma client after schema changes
npx prisma generate
```

---

## 6. Seed Data

The seed script (`backend/prisma/seed.ts`) creates:

1. **1 Agency** — Neirah Tech Digital Agency
2. **2 Users** — admin + sales representative
3. **1 Role** — ADMIN (with all permissions)
4. **2 Clients** — Acme Corp, Bright Digital Ltd
5. **2 Pipelines** — Software Services + Digital Marketing (with all stages)
6. **6 Deals** — spread across stages with realistic values
7. **DealIntelligence** — pre-calculated for demo deals
8. **DealFollowUps** — a mix of upcoming, overdue, completed
9. **DealActivities** — stage history entries for demo deals
