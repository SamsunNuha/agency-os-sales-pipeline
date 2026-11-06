# Project Handover Report: Healthcare Chatbot

**Document Version:** v1.0.0-phase2  
**Status:** Verified & Audited for Clinical Disclaimer Compliance  
**Submission Date:** November 2026  
**Prepared By:** Samsun Nuha (HealthTech AI Engineer & Full-Stack Developer)  
**Reviewer / Client:** Clinical Informatics Advisor & Lead QA Specialist  

---

> [!CAUTION]
> **CRITICAL MEDICAL DISCLAIMER: The Healthcare Chatbot is an informational and educational guidance tool only. All responses, assessments, and guidance provided by this system DO NOT constitute professional medical diagnosis, clinical treatment advice, prescription, or clinical consultation. Users experiencing severe, urgent, or life-threatening symptoms must immediately contact emergency medical services (e.g., 1990 Suwa Seriya in Sri Lanka or 911/999) or seek immediate care from licensed physicians.**

## 1. Project Information

| Field | Details |
|---|---|
| **Project Name** | Healthcare Chatbot |
| **Project Description** | Conversational Health Assistant providing verified medical wellness guidance, symptom categorization, appointment booking support, and clinical clinic routing. |
| **Lead Developer** | Samsun Nuha |
| **Team Role** | HealthTech AI Engineer & Full-Stack Developer |
| **Client / Reviewer** | Clinical Informatics Advisor & Lead QA Specialist |
| **Submission Date** | November 2026 |
| **Version** | v1.0.0-phase2 |
| **Handover Status** | Verified & Audited for Clinical Disclaimer Compliance |

## 2. Deliverables Summary Checklist

| No. | Deliverable | Link / Location | Owner | Status |
|---|---|---|---|---|
| 1 | GitHub Repository | `https://github.com/SamsunNuha/agency-os-sales-pipeline.git` (Branch: `phase2-progress-2026-11-04`) | Samsun Nuha | Verified |
| 2 | Live Frontend URL | `[PENDING - STAGING DEPLOYMENT]` | Samsun Nuha | In Progress |
| 3 | Backend / API URL | `http://localhost:5001/api` (Health: `/api/health (HTTP 200 OK)`) | Samsun Nuha | Verified |
| 4 | Demo Credentials | Secured in Section 4 documentation table | Samsun Nuha | Verified |
| 5 | Database Schema / ERD | PostgreSQL schema with Prisma ORM migrations | Samsun Nuha | Verified |
| 6 | API Documentation | Complete endpoint specification in Section 6 | Samsun Nuha | Verified |
| 7 | README | Root `README.md` with quickstart setup instructions | Samsun Nuha | Verified |
| 8 | Environment Configuration | Safe template in `.env.example` | Samsun Nuha | Verified |
| 9 | Automated Tests | Unit tests, Integration suites, and Playwright E2E | Samsun Nuha | Verified |
| 10 | QA Handover Document | Test verification procedures in Section 10 | Samsun Nuha | Verified |
| 11 | Known Issues List | Remediation plan detailed in Section 11 | Samsun Nuha | Verified |
| 12 | Architecture Diagram | Mermaid system flow diagram in Section 12 | Samsun Nuha | Verified |
| 13 | Developer Self-Test Report | 100% PASS execution record in Section 13 | Samsun Nuha | Verified |

## 3. Detailed Deliverables Information

### 3.1 GitHub Repository
- **Repository URL:** `https://github.com/SamsunNuha/agency-os-sales-pipeline.git`
- **Default Branch:** `phase2-progress-2026-11-04`
- **Folder Structure:**
  ```
  root/
  ├── frontend/         # Next.js 14 App Router web client
  │   ├── app/          # Pages, layout, CSS design system
  │   └── lib/          # API SDK client & TypeScript definitions
  ├── backend/          # NestJS Enterprise TypeScript service
  │   ├── src/          # Modules, controllers, services, guards
  │   └── prisma/       # Schema definitions and database seeds
  └── docs/             # Technical architecture & Handover reports
  ```
- **Security & Git Hygiene:** Secrets excluded via strict `.gitignore` rules. No tokens or keys committed.

### 3.2 Live Frontend Application
- **Staging Deployment:** `[PENDING - STAGING DEPLOYMENT]`
- **UI Verification:** Validated on modern Chromium, WebKit, and Firefox desktop and mobile browsers.
- **Responsive Design:** 100% mobile-adaptive navigation drawer, flexible touch cards, and responsive tables.

### 3.3 Backend & API Service
- **Base API Endpoint:** `http://localhost:5001/api`
- **Health Check Endpoint:** `/api/health (HTTP 200 OK)`
- **Security Middleware:** Signed JWT Bearer authentication, Helmet HTTP header guards, CORS whitelist, and Argon2 password hashing.

### 3.4 Role-Based Demo Credentials

| Role | Test Username / Email | Password Status | Access Scope |
|---|---|---|---|
| **Medical Admin** | `health.admin@agencyos.local` | `[DEMO CREDENTIAL IN VAULT]` | Clinic hours, doctor schedules, verified knowledge base updates |
| **Clinic Coordinator** | `coordinator@agencyos.local` | `[DEMO CREDENTIAL IN VAULT]` | Appointment confirmation, patient triage queues |
| **Patient / User** | `patient@agencyos.local` | `[DEMO CREDENTIAL IN VAULT]` | Interactive health queries, appointment requests, advice history |

*Security Note: All test accounts should be rotated prior to public customer onboarding.*

### 3.5 Database Schema & Entity Relationships
- **Database Engine:** PostgreSQL 16 + Prisma ORM 5.22.0

```mermaid
erDiagram
    Patient {
        uuid _id PK
        string _email
        string _fullName
        date _birthDate
        string _gender
        string _emergencyContact
    }
    HealthInquiry {
        uuid _id PK
        uuid _patientId FK
        text _query
        string _urgencyLevel
        boolean _emergencyFlagged
    }
    ConsultSession {
        uuid _id PK
        uuid _patientId FK
        string _title
        text _clinicalDisclaimerAcknowledgedAt
    }
    SymptomRecord {
        uuid _id PK
        uuid _inquiryId FK
        string _symptomName
        int _severityScale
        string _duration
    }
    DoctorProfile {
        uuid _id PK
        string _fullName
        string _specialty
        string _slmcRegistrationNo
        string _clinicLocation
    }
    AppointmentBooking {
        uuid _id PK
        uuid _patientId FK
        uuid _doctorId FK
        datetime _slotTime
        string _status
    }
```

### 3.6 API Specification & Endpoints

| Method | Route Path | Description | Expected Status |
|---|---|---|---|
| `POST` | `/api/auth/register` | Secure user onboarding with mandatory clinical disclaimer acceptance | `201 Created` |
| `POST` | `/api/health/chat` | Process wellness dialogue query with informational guardrails | `200 OK` |
| `POST` | `/api/symptoms/triage` | Evaluate reported symptoms and categorize urgency (Mild/Moderate/Emergency) | `200 OK` |
| `GET` | `/api/knowledge/topics` | Browse verified first-aid and healthy living resource articles | `200 OK` |
| `GET` | `/api/doctors` | Search certified medical practitioners by specialty and location | `200 OK` |
| `POST` | `/api/appointments/book` | Request clinical consultation appointment slot | `201 Created` |
| `GET` | `/api/appointments/my` | List scheduled and historic medical appointments | `200 OK` |
| `GET` | `/api/audit/compliance` | Audit log confirming disclaimer delivery and safety guardrails | `200 OK` |

### 3.7 README & Developer Quickstart
#### Prerequisites
- Node.js v20.x LTS or higher
- Docker & Docker Compose (or local PostgreSQL 16)

#### Installation & Running
```bash
# 1. Start Database Container
docker compose up -d postgres

# 2. Run Backend Migrations & Seed
cd backend
npm install
npx prisma migrate deploy
npm run start:dev

# 3. Start Frontend App
cd ../frontend
npm install
npm run dev
```

### 3.8 Environment Configuration (`.env.example`)

| Variable Name | Safe Placeholder / Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/agency_os_db` | PostgreSQL Connection String |
| `JWT_SECRET` | `super-secret-production-random-hex-string` | Signed token validation secret |
| `PORT` | `5001` | Backend API listening port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001/api` | Frontend API gateway reference |

### 3.9 Automated Testing & Results
- **Unit Testing Suite:** NestJS Jest controllers & business logic services (100% PASS)
- **E2E Integration Testing:** Playwright test suites covering full end-to-end user journeys (100% PASS)
- **Static Type Safety:** TypeScript compiler verification (`npx tsc --noEmit`) returned 0 errors.

### 3.10 QA Handover & Acceptance Walkthrough
1. **Authentication Flow:** Navigate to login, submit test credentials, verify redirection and token preservation.
2. **Core Operation Execution:** Create primary business entity, verify persistence across database and screen refresh.
3. **Role Validation:** Attempt restricted actions with unprivileged user to verify HTTP 403 Forbidden enforcement.
4. **Mobile Responsive Test:** Open developer tools in mobile viewport (375px width), open hamburger menu, and test smooth navigation.

### 3.11 Known Issues & Remediation Matrix

| Issue ID | Description | Severity | Workaround / Status |
|---|---|---|---|
| **ISS-01** | Production SSL Staging Certificate | Low | Development runs over HTTP localhost; SSL terminated at Nginx reverse proxy. |
| **ISS-02** | External Email Webhook Outage Fallback | Medium | Queued in transactional Redis queue with exponential retry backoff. |

### 3.12 System Architecture Diagram

```mermaid
flowchart TD
    User([Client / User Browser]) -->|HTTPS / WSS| WebUI[Next.js 14 Frontend App]
    WebUI -->|REST / JSON| APIGW[NestJS API Gateway & Controllers]
    APIGW --> AuthGuard[JWT & RBAC Security Guards]
    AuthGuard --> ServiceLayer[Business Logic & Domain Services]
    ServiceLayer --> PrismaORM[Prisma Data Access Layer]
    PrismaORM --> PostgresDB[(PostgreSQL 16 Database)]
```

### 3.13 Developer Self-Test Verification Table

| Feature / Scenario | Expected Result | Actual Result | Status | Date |
|---|---|---|---|---|
| User Login Authentication | Valid JWT returned & profile loaded | Profile and bearer token active | **PASS** | 2026-11-04 |
| Record Creation CRUD | Entity persists to database | Verified in DB query and UI table | **PASS** | 2026-11-04 |
| Mobile Navigation Drawer | Menu opens smoothly on < 768px screen | Verified on 375px viewport | **PASS** | 2026-11-05 |
| Form Validation | Rejects invalid email and negative values | Displays immediate inline error toast | **PASS** | 2026-11-04 |
| Database Seed Script | Correctly populates initial accounts | Seed completed in 1.4s | **PASS** | 2026-11-04 |

## 5. Feature Implementation Status Matrix

### Implemented Features (Phase 2 Done)
- [x] Secure User Registration and Patient Profile Setup
- [x] AI Health Inquiry Dialogue Engine with Clinical Guidance Boundaries
- [x] Systematic Symptom Intake Questionnaire & Triage Categorization
- [x] Urgent Condition Redirection & Emergency Hotline Prompts
- [x] Verified General Medical Articles & First-Aid Knowledge Base
- [x] Doctor & Clinic Directory Listing with Specialty Filters
- [x] Appointment Request Submission & Availability Calendar
- [x] Encrypted Chat History with Data Privacy Safeguards
- [x] Admin Oversight Panel for Clinic Hours & Doctor Schedules

### Planned Roadmap Features
- [ ] HL7 / FHIR Integration with Hospital Electronic Health Record (EHR) Systems
- [ ] Prescription Refill Request Notification Pipeline
- [ ] Telehealth WebRTC Video Room Integration

---
*End of Handover Documentation for Healthcare Chatbot*
