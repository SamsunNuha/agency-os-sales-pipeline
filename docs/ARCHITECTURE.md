# Architecture — Agency OS Sales Pipeline & Deal Management

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser / Client                      │
│              Next.js 16 (App Router, React 19)            │
│         TypeScript · Tailwind CSS · dnd-kit               │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS / REST API
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     NestJS 9 API Server                   │
│              TypeScript · Passport-JWT · Swagger          │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌─────────┐ │
│  │  Auth    │ │  Deals   │ │  Pipelines  │ │Follow-  │ │
│  │  Module  │ │  Module  │ │  Module     │ │Ups Mod  │ │
│  └──────────┘ └──────────┘ └─────────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌─────────┐ │
│  │Probability│ │ Stalled  │ │  Handoff    │ │Dashboard│ │
│  │  Service  │ │Detection │ │  Service    │ │ Service │ │
│  └──────────┘ └──────────┘ └─────────────┘ └─────────┘ │
│                     Prisma ORM                            │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               PostgreSQL 15 (Docker Compose)              │
│            agency_os_sales database                       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### Technology
- **Next.js 16** with App Router
- **React 19** with Server and Client components
- **TypeScript 5** for full type safety
- **Tailwind CSS 4** with custom design tokens
- **dnd-kit** for drag-and-drop Kanban
- **Responsive UI** with native SVG iconography and typed state management

### Directory Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root application shell
│   ├── globals.css             # Design tokens & base styles
│   ├── page.tsx                # Redirect to /sales
│   └── sales/
│       ├── page.tsx            # Sales dashboard
│       ├── deals/
│       │   ├── page.tsx        # All deals list
│       │   ├── new/page.tsx    # New deal form
│       │   └── [id]/page.tsx   # Deal detail & activity
│       ├── pipelines/
│       │   └── page.tsx        # Kanban board
│       ├── follow-ups/
│       │   └── page.tsx        # Follow-up management
│       └── settings/
│           └── page.tsx        # Pipeline settings
├── components/
│   ├── ui/                     # Reusable design system components
│   ├── layout/                 # Sidebar, TopNav, Shell
│   ├── deals/                  # Deal cards, forms, detail
│   ├── pipeline/               # Kanban board, columns, cards
│   ├── follow-ups/             # Follow-up list, form
│   └── dashboard/              # Dashboard widgets
├── lib/
│   ├── api/                    # Typed API client functions
│   ├── types/                  # Shared TypeScript interfaces
│   ├── utils/                  # Utility functions
│   └── constants/              # App constants
├── hooks/                      # Custom React hooks
└── middleware.ts               # Auth middleware (JWT token check)
```

### Design System Tokens

| Token | Value |
|-------|-------|
| Primary | `#2563EB` |
| Primary Dark | `#1D4ED8` |
| Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Text Primary | `#0F172A` |
| Text Secondary | `#475569` |
| Border | `#E2E8F0` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Error | `#DC2626` |
| Font | Inter (Google Fonts) |

---

## 3. Backend Architecture

### NestJS Modules

| Module | Responsibility |
|--------|---------------|
| `AppModule` | Root module — imports all feature modules |
| `AuthModule` | JWT authentication, login, user context |
| `PrismaModule` | Shared Prisma client (global singleton) |
| `DealsModule` | Deal CRUD, stage movement, Won/Lost |
| `PipelinesModule` | Pipeline and stage management |
| `FollowUpsModule` | Follow-up lifecycle |
| `ProbabilityModule` | Deterministic probability scoring |
| `StalledDetectionModule` | Inactivity monitoring |
| `ActivitiesModule` | Deal activity log |
| `HandoffModule` | Won deal → Project handoff boundary |
| `DashboardModule` | Sales statistics aggregation |
| `CommonModule` | Shared guards, interceptors, filters |

### Request Flow

```
Request → JwtAuthGuard → RolesGuard → Controller → Service → PrismaService → PostgreSQL
                                                       ↓
                                               ResponseInterceptor (standard format)
                                                       ↓
                                               AllExceptionsFilter (safe errors)
```

### Security Model

1. **JWT-ready**: Every protected route requires a valid `Bearer` token.
2. **RBAC**: `@Roles()` decorator + `RolesGuard` on all controllers.
3. **Agency isolation**: `agencyId` is always derived from the JWT payload — never from the request body.
4. **DTO validation**: `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` applied globally.
5. **Safe errors**: `AllExceptionsFilter` catches all unhandled errors and returns a sanitized response.

---

## 4. Multi-Tenancy

- Every database entity (Deal, Pipeline, Stage, Client, FollowUp) carries an `agencyId` foreign key.
- All service queries include `WHERE agencyId = :currentAgencyId`.
- The `agencyId` is extracted from the authenticated user's JWT — never from the browser payload.
- Cross-tenant access is tested in the security test suite.

---

## 5. Integration Points

| Point | Description |
|-------|-------------|
| **Project module** | `POST /api/deals/:id/project-handoff` returns a stable payload consumed by the future Project Delivery module. |
| **Notification system** | `DealActivity` and `DealFollowUp` emit structured events. Connect to the shared event bus when available. |
| **CRM / Client module** | The `Client` entity is defined here. Migrate to the shared CRM model when the platform consolidates. |
| **Auth provider** | `AuthModule` implements local JWT. Replace with platform identity provider (Auth0, Keycloak, etc.) by swapping the strategy. |
| **AI probability** | `ProbabilityService` interface is designed to be swapped with an ML-based prediction service. |
