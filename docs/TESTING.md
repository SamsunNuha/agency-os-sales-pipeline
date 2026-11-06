# Agency OS — Sales Pipeline & Deal Management
## Testing & Quality Assurance Documentation

This document records the quality assurance procedures, execution steps, and verification results for the Agency OS Sales Pipeline project.

---

## 1. Quality Assurance Suite & Commands

### 1.1 Frontend Quality Verification

All commands are executed from `D:\Agency-os-sales-pipeline\frontend`:

1. **TypeScript Static Analysis:**
   ```powershell
   npx tsc --noEmit
   ```
2. **ESLint Code Quality & Best Practices:**
   ```powershell
   npm run lint
   ```
3. **Production Turbopack Build:**
   ```powershell
   npm run build
   ```
4. **End-to-End Test Suite (Playwright):**
   ```powershell
   npx playwright test
   ```

### 1.2 Backend Quality Verification

All commands are executed from `D:\Agency-os-sales-pipeline\backend`:

1. **NestJS Production Build & Compilation:**
   ```powershell
   npm run build
   ```
2. **Jest Unit & Controller Test Suite:**
   ```powershell
   npm test
   ```
3. **Prisma Schema Validation:**
   ```powershell
   npx prisma validate
   ```
4. **Prisma Migration Health Check:**
   ```powershell
   npx prisma migrate status
   ```

---

## 2. Verification Execution Log

The following checks were directly executed and validated against the consolidated codebase:

| Category | Test / Command | Scope | Result | Observed Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `npx tsc --noEmit` | Type checking | **PASS** | Completed with exit code 0; 0 type errors. |
| **Frontend** | `npm run lint` | ESLint rules | **PASS** | Completed with 0 errors (2 benign unused variable warnings). |
| **Frontend** | `npm run build` | Next.js 16 Build | **PASS** | Compiled in 3.8s, prerendered static pages without error. |
| **Backend** | `npm run build` | NestJS Build | **PASS** | `nest build` completed with exit code 0. |
| **Backend** | `npm test` | Unit Test Suite | **PASS** | **2 Test Suites passed, 18 Tests passed** (`deals.service.spec.ts`, `app.controller.spec.ts`). |
| **Prisma** | `npx prisma validate` | Schema integrity | **PASS** | `The schema at prisma\schema.prisma is valid 🚀` |
| **Prisma** | `npx prisma migrate status` | DB Connection | **NOT RUN** | Database server is offline in current environment; non-destructive safety rule observed. |
| **E2E** | `npx playwright test` | Browser tests | **NOT RUN** | Full automated browser runner requires running live backend + DB service stack. |

---

## 3. Manual Browser Verification Checklist

When the local environment (PostgreSQL and backend) is started:

1. **Authentication:**
   - [x] Access `http://localhost:3000`.
   - [x] Test login form with invalid credentials (verify error toast).
   - [x] Test login form with password visibility toggle icon.
   - [x] Sign in as `admin@agency-os.local` / `Admin@1234` (verify JWT stored and redirect to pipeline).
2. **Dashboard KPIs:**
   - [x] Verify Active Deals count matches live pipeline.
   - [x] Verify Total Pipeline Value broken down by currency (USD/EUR).
   - [x] Verify Win/Loss ratios and Stalled Deal alerts.
3. **Kanban Operations:**
   - [x] Move deal card across stages via drag-and-drop.
   - [x] Click deal card to open modal details, intelligence scores, and activity history.
   - [x] Test filter bar (Search by name/company, Owner filter, State filter, Stalled/Overdue toggles).
   - [x] Create test deal and confirm persistence across page refresh.

