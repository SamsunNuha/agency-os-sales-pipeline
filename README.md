# Agency OS — Sales Pipeline & Deal Management

> **Production-grade CRM and Sales Pipeline Management System engineered specifically for digital agencies.**  
> Built with Next.js 16, React 19, NestJS 10, Prisma ORM, and PostgreSQL.

---

## 1. Project Overview & Features

Agency OS provides digital agency teams with end-to-end deal tracking, sales pipeline automation, and delivery handoffs:

- **Interactive Kanban Pipeline:** Drag-and-drop stage progression powered by `@dnd-kit`, supporting multi-currency deals and optimistic UI updates.
- **Executive KPI Dashboard:** Real-time metrics tracking active deals, win/loss conversion rates, and pipeline value grouped by currency.
- **Deal Intelligence & Health Scoring:** Automatic win probability calculation and stalled-deal detection based on stage age SLAs and activity frequency.
- **Activity & Follow-Up Auditing:** Complete history log of stage movements, client communications, and scheduled follow-up tasks.
- **Project Handoff Workflow:** Smooth operational transition when opportunities reach `CLOSED_WON`.
- **Role-Based Access Control (RBAC):** Granular permissions supporting `ADMIN`, `MANAGER`, `SALES_REP`, and `OPERATIONS`.

---

## 2. Technology Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `@dnd-kit`, TypeScript 5, Lucide Icons.
- **Backend:** NestJS 10, TypeScript, Passport.js JWT Authentication, Class Validator, RxJS.
- **Database & ORM:** PostgreSQL 16, Prisma ORM 5.
- **Quality Assurance & Testing:** Jest, Playwright E2E, ESLint, TypeScript Strict Mode.
- **Infrastructure:** Docker & Docker Compose.

---

## 3. Project Folder Structure

```text
Agency-os-sales-pipeline/
├── backend/                  # NestJS API application
│   ├── prisma/               # Prisma schema & migration history
│   │   ├── migrations/       # Version-controlled SQL migrations
│   │   ├── schema.prisma     # Relational database schema
│   │   └── seed.ts           # Development seed data script
│   ├── src/                  # NestJS application modules
│   │   ├── auth/             # Authentication & JWT strategies
│   │   ├── deals/            # Deal creation, update, stage transition
│   │   ├── pipelines/        # Pipeline & stage configurations
│   │   ├── dashboard/        # KPI analytics & statistics
│   │   ├── activities/       # Deal activity audit log
│   │   ├── follow-ups/       # Follow-up reminders & tasks
│   │   ├── probability/      # Win probability engine
│   │   ├── stalled-detection/# Inactivity SLA detection
│   │   └── handoff/          # Project handoff management
│   ├── package.json
│   └── .env.example          # Safe backend environment template
├── frontend/                 # Next.js 16 web application
│   ├── app/                  # Next.js App Router
│   │   ├── components/       # Reusable UI components
│   │   ├── layout.tsx        # Root application layout
│   │   ├── page.tsx          # Main Kanban & Dashboard interface
│   │   └── lib.ts            # Typed API client & formatting utilities
│   ├── public/               # Static assets & brand logos
│   ├── package.json
│   └── .env.example          # Safe frontend environment template
├── docs/                     # Technical documentation & handover
│   ├── API_DOCUMENTATION.md  # Comprehensive API reference
│   ├── ARCHITECTURE.md       # High-level architecture guide
│   ├── DATABASE.md           # Relational schema reference
│   ├── DEPENDENCIES.md       # Package manifest & dependency audit
│   ├── TECHNICAL_HANDOVER.md # Developer technical handover
│   └── TESTING.md            # Test suite guide & verification log
├── docker-compose.yml        # PostgreSQL & PgAdmin service setup
├── CONTRIBUTING.md           # Development guidelines
├── LICENSE                   # Open-source license
├── README.md                 # Project README
└── .gitignore                # Root Git ignore rules
```

---

## 4. Prerequisites

Ensure you have the following installed locally:
- **Node.js:** `v20.x` or later (LTS recommended)
- **npm:** `v10.x` or later
- **Docker Desktop:** Required for running the local PostgreSQL database

---

## 5. Installation & Setup

### 5.1 Clone Repository
```bash
git clone https://github.com/SamsunNuha/agency-os-sales-pipeline.git
cd agency-os-sales-pipeline
```

### 5.2 Environment Configuration
Create the local environment files from the provided templates:

1. **Backend Environment:**
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```
2. **Frontend Environment:**
   ```powershell
   Copy-Item frontend\.env.example frontend\.env.local
   ```

*Note: The default `.env.example` values align directly with the provided `docker-compose.yml` service configuration.*

---

## 6. Database & Docker Setup

Start the PostgreSQL service container:
```bash
docker-compose up -d postgres
```

### Apply Migrations & Generate Client
From the `backend/` directory:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

### Seed Development Data (Optional)
Populate standard pipelines, demo sales reps, and initial opportunity cards:
```bash
npm run seed
```

---

## 7. Running the Application

### 7.1 Start Backend Server
```bash
cd backend
npm run start:dev
```
- **Backend API URL:** `http://localhost:5001/api`
- **Health Check Endpoint:** `http://localhost:5001/api`

### 7.2 Start Frontend Application
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- **Frontend Web Application:** `http://localhost:3000`

---

## 8. Default Credentials & Ports

| Service | Host URL / Port | Credentials (Dev) |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:3000` | — |
| **Backend API** | `http://localhost:5001/api` | Bearer JWT |
| **Default Admin Account** | `http://localhost:3000` | `admin@agency-os.local` / `Password123!` |
| **PostgreSQL Database** | `localhost:5432` | User: `agency_os_user` / DB: `agency_os_sales` |
| **PgAdmin (Optional)** | `http://localhost:5050` | `admin@agency-os.local` / `changeme_in_env` |

---

## 9. Verification & Testing

To run the full suite of verification commands:

```bash
# Frontend Type Check & Lint
cd frontend
npx tsc --noEmit
npm run lint

# Frontend Production Build
npm run build

# Backend Tests & Build
cd ../backend
npm test
npm run build
npx prisma validate
```

For detailed QA results, see [docs/TESTING.md](file:///D:/Agency-os-sales-pipeline/docs/TESTING.md).

---

## 10. Troubleshooting

- **Database Connection Error (`P1001`):** Ensure Docker Desktop is active and run `docker ps` to verify the `agency_os_postgres` container is listening on port `5432`.
- **Hydration / Next.js Build Font Warning:** When building without active internet connectivity, Turbopack may warn regarding the Google Fonts fetch. The build will successfully complete with fallback system typography.
- **Port Conflict (5000/5001):** If port 5000 is occupied by a system service (e.g. AirPlay/macOS or local service), update `PORT=5001` in `backend/.env` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/api` in `frontend/.env.local`.

---

## 11. Technical Handover & API Reference

- Detailed API specifications: [docs/API_DOCUMENTATION.md](file:///D:/Agency-os-sales-pipeline/docs/API_DOCUMENTATION.md)
- Complete architectural handover: [docs/TECHNICAL_HANDOVER.md](file:///D:/Agency-os-sales-pipeline/docs/TECHNICAL_HANDOVER.md)
- Dependency audit: [docs/DEPENDENCIES.md](file:///D:/Agency-os-sales-pipeline/docs/DEPENDENCIES.md)
