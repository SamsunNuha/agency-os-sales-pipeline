# Agency OS — Sales Pipeline & Deal Management
## Dependencies Documentation

This document records key dependencies utilized in the Agency OS Sales Pipeline project, their architectural purpose, and where they are applied.

---

## 1. Frontend Dependencies (`/frontend`)

| Package Name | Version | Role / Scope | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **`next`** | `^16.4.3` | Core Framework | Next.js App Router for server and client components, optimized static generation, and Turbopack compiler. |
| **`react` & `react-dom`** | `^19.0.0` | View Layer | React 19 concurrent features, transitions, and component state management. |
| **`@dnd-kit/core`** | `^6.3.1` | UI Interaction | Drag-and-drop primitives powering the interactive Kanban board stage movement. |
| **`@dnd-kit/sortable`** | `^10.0.0` | UI Interaction | Sortable list mechanics for deal cards within columns. |
| **`@dnd-kit/utilities`** | `^3.2.2` | Helper Library | CSS transform string generators for smooth card dragging transitions. |
| **`tailwindcss`** | `^4.0.0` | Styling | Utility-first CSS framework integrated via `@tailwindcss/turbopack`. |
| **`typescript`** | `^5.0.0` | Developer Tool | Strict static type checking across all client components. |
| **`eslint`** | `^9.0.0` | Linter | Code quality enforcement with custom TypeScript and React Hooks configurations. |

---

## 2. Backend Dependencies (`/backend`)

| Package Name | Version | Role / Scope | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **`@nestjs/core`** | `^9.0.0` | Core Framework | Enterprise-grade TypeScript server framework with dependency injection and modular architecture. |
| **`@nestjs/common`** | `^9.0.0` | Core Framework | Decorators, HTTP abstractions, and lifecycle hooks. |
| **`@nestjs/jwt`** | `^10.2.0` | Authentication | JSON Web Token signing and verification for session management. |
| **`@nestjs/passport`** | `^10.0.3` | Authentication | Passport integration layer for NestJS. |
| **`passport-jwt`** | `^4.0.1` | Authentication | Strategy extracting and validating Bearer tokens in incoming HTTP requests. |
| **`bcrypt`** | `^5.1.1` | Security | Salted cryptographic password hashing for user accounts. |
| **`@prisma/client`** | `^5.10.0` | Database ORM | Type-safe database client querying PostgreSQL. |
| **`class-validator`** | `^0.14.1` | Data Validation | Decorator-based input validation on incoming DTOs (`CreateDealDto`, `LoginDto`, etc.). |
| **`class-transformer`** | `^0.5.1` | Data Serialization | Serializing and mapping raw JSON payloads to typed DTO classes. |
| **`prisma`** | `^5.10.0` | Developer Tool | Schema migrations, Prisma client code generator, and introspection CLI. |
| **`jest`** | `^29.5.0` | Testing Suite | Automated unit testing framework for service and controller validation. |

---

## 3. Infrastructure & Tooling Dependencies

| Tool / Technology | Version / Spec | Purpose & Usage |
| :--- | :--- | :--- |
| **PostgreSQL** | `15-alpine` | Primary ACID-compliant relational database. |
| **Docker Compose** | `v3.8` | Container orchestration defining Postgres and PgAdmin services for local development. |

