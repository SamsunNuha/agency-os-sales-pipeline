# Agency OS — Sales Pipeline & Deal Management

A production-grade, full-stack Sales Pipeline and Deal Management system for digital agencies, built by **Neirah Tech** as part of the Agency OS platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Prerequisites](#4-prerequisites)
5. [Installation](#5-installation)
6. [Environment Configuration](#6-environment-configuration)
7. [Database Setup](#7-database-setup)
8. [Running the Application](#8-running-the-application)
9. [Testing](#9-testing)
10. [API Documentation](#10-api-documentation)
11. [Production Build](#11-production-build)
12. [Troubleshooting](#12-troubleshooting)
13. [Demo Login](#13-demo-login)
14. [Known Limitations & Integration Points](#14-known-limitations--integration-points)

---

## 1. Project Overview

Agency OS Sales Pipeline provides authorized agency users with:

- **Multi-pipeline deal management** — create, assign, and manage deals across pipelines.
- **Interactive Kanban board** — drag-and-drop deal cards with backend persistence.
- **Deal probability engine** — deterministic, explainable scoring (not AI-generated).
- **Stalled deal detection** — configurable inactivity thresholds.
- **Follow-up management** — schedule, complete, and reschedule follow-ups.
- **Won/Lost workflows** — controlled closures with mandatory lost reasons.
- **Project handoff API** — stable boundary for the future Project Delivery module.
- **Sales dashboard** — real statistics from the database.
- **Multi-tenancy** — full agency isolation; Agency A never sees Agency B data.
- **RBAC** — role and permission guards on every protected endpoint.

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16.x |
| Frontend | React | 19.x |
| Frontend | TypeScript | 5.x |
| Frontend | Tailwind CSS | 4.x |
| Frontend | dnd-kit | 6.x |
| Frontend | Zod | 3.x |
| Frontend | React Hook Form | 7.x |
| Frontend | Lucide React | latest |
| Backend | NestJS | 9.x |
| Backend | TypeScript | 5.x |
| Backend | Node.js | 20.x LTS |
| Backend | Passport (JWT) | 10.x |
| Backend | Swagger / OpenAPI | 7.x |
| Database | PostgreSQL | 15 |
| ORM | Prisma | 5.x |
| Testing | Jest + Supertest | 29.x |
| Testing | Playwright | latest |
| Dev DB | Docker Compose | latest |

---

## 3. Architecture

```
agency-os-sales-pipeline/
├── frontend/          # Next.js App Router application
├── backend/           # NestJS REST API
├── docs/              # Architecture, DB schema, API docs, guides
├── docker-compose.yml # Local PostgreSQL + pgAdmin
├── .gitignore
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture diagram and module breakdown.

---

## 4. Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 20.x LTS |
| npm | 10.x |
| Docker Desktop | 4.x |
| Git | 2.x |

---

## 5. Installation

```bash
# 1. Clone the repository
git clone https://github.com/neirah-tech/agency-os-sales-pipeline.git
cd agency-os-sales-pipeline

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
cd ..
```

---

## 6. Environment Configuration

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, FRONTEND_URL
```

Generate a secure JWT secret:

```bash
node -e "require('crypto').randomBytes(64).toString('hex').then ? console.log(require('crypto').randomBytes(64).toString('hex')) : undefined"
# or simply:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_BASE_URL
```

---

## 7. Database Setup

### Start PostgreSQL with Docker Compose

```bash
# From the project root
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **pgAdmin** on port `5050` (optional UI)

### Run Prisma Migrations

```bash
cd backend
npx prisma migrate dev --name init
```

### Seed the Database

```bash
cd backend
npm run seed
# or: npx prisma db seed
```

This creates:
- Default agency: **Neirah Tech Digital Agency**
- Admin user: `admin@agency-os.local` / password from `.env` → `SEED_ADMIN_PASSWORD`
- Sample user: `sales@agency-os.local`
- Two demo pipelines: **Software Services**, **Digital Marketing**
- All pipeline stages
- Demo clients and deals

### View Database in pgAdmin

1. Open [http://localhost:5050](http://localhost:5050)
2. Login with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `.env`
3. Add server: Host `postgres`, Port `5432`, DB/User/Password from `.env`

---

## 8. Running the Application

### Backend (NestJS)

```bash
cd backend
npm run start:dev
```

API runs at: `http://localhost:5001/api`  
Swagger UI: `http://localhost:5001/api/docs`

### Frontend (Next.js)

```bash
cd frontend
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## 9. Testing

### Backend Unit & Integration Tests

```bash
cd backend
npm run test           # all unit tests
npm run test:cov       # with coverage
npm run test:e2e       # API integration tests
```

### Frontend Tests

```bash
cd frontend
npm run test           # Jest + React Testing Library
```

### End-to-End Tests (Playwright)

```bash
# From project root (both servers must be running)
npx playwright test
```

---

## 10. API Documentation

- **Swagger UI**: `http://localhost:5001/api/docs` (when backend is running)
- **Markdown docs**: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

---

## 11. Production Build

### Backend

```bash
cd backend
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

---

## 12. Troubleshooting

| Problem | Solution |
|---------|----------|
| `DATABASE_URL` error | Ensure Docker Compose is running and `.env` has correct credentials. |
| `JWT_SECRET` error | Copy `.env.example` to `.env` and generate a secure value. |
| Frontend can't reach API | Check that the backend is running on port 5001 (`PORT=5001` in `.env`). The frontend fetches from `http://localhost:5001/api`. |
| Prisma migration errors | Run `npx prisma migrate reset` (destroys data) then `npx prisma migrate dev`. |
| Port already in use | Change `PORT` in backend `.env` or `POSTGRES_PORT` in docker-compose. |
| npm peer dep conflicts | Use the exact package versions listed in this README. Do not add `--legacy-peer-deps`. |

---

## 13. Demo Login

After seeding, use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@agency-os.local` | value of `SEED_ADMIN_PASSWORD` in `.env` |
| Sales User | `sales@agency-os.local` | value of `SEED_ADMIN_PASSWORD` in `.env` |

> **Security Note:** These are development-only seed credentials. Change passwords before any production deployment. The application uses bcrypt for password hashing and JWT for authentication.

---

## 14. Known Limitations & Integration Points

| Item | Status | Notes |
|------|--------|-------|
| Email notifications | Placeholder | Integration points prepared in `DealFollowUp` and `DealActivity` service. Connect to shared notification module. |
| Project module handoff | API boundary ready | `POST /api/deals/:id/project-handoff` returns a stable payload. Project module must consume this endpoint. |
| Client/Lead module | Client entity included | Reuses the `Client` model. Connect to the shared CRM module when available. |
| AI probability engine | Rule-based | Current engine is deterministic and explainable. Designed to be replaced by an ML service via the `ProbabilityService` interface. |
| Real-time updates | Not implemented | WebSocket integration points are prepared. Connect to a shared event bus. |
| Production auth provider | JWT scaffold only | Replace `AuthModule` with your production identity provider (e.g., Auth0, Keycloak). |
| Multi-file upload | Not implemented | Deal notes and handoff payload support text. File attachment integration point is documented. |

## Production Readiness Checklist
- Verify all environment variables are defined and no secrets are committed.
- Ensure FRONTEND_URL and BACKEND URL are configurable via .env files.
- Confirm CORS settings allow only the intended frontend origin.
- Remove any development-only debug UI or tooling.
- Run `npm run lint` and `npm run build` for both frontend and backend without errors.

## Remaining Blockers
- Frontend build fails due to missing `emitAuth` function in `app/page.tsx`. Needs implementation or removal.
- Backend e2e tests fail for authentication flows; likely due to placeholder JWT secret and seed admin password. Set secure `JWT_SECRET` and correct `SEED_ADMIN_PASSWORD` in `.env`.
- Production deployment target not configured in this repository.
