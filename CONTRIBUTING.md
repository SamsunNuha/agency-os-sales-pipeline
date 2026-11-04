# Contributing to Agency OS — Sales Pipeline

Thank you for contributing to this project. Please follow the guidelines below to ensure code quality, consistency, and security.

---

## Development Standards

### Code Style

- **TypeScript** is mandatory for all source files.
- **ESLint** and **Prettier** are pre-configured. Run `npm run lint` before every commit.
- Use `camelCase` for variables and functions, `PascalCase` for classes and types.
- Always type function parameters and return values explicitly.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(deals): add drag-and-drop stage movement
fix(auth): correct JWT expiry validation
docs(readme): update database setup instructions
test(pipeline): add stage transition unit tests
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`.

### Branching Strategy

- `main` — production-ready code only.
- `develop` — integration branch for feature work.
- `feature/<name>` — individual feature branches.
- `fix/<name>` — bug fix branches.
- `chore/<name>` — maintenance, tooling, documentation.

### Pull Requests

- Link to the relevant issue or specification section.
- Include a description of what changed and why.
- Ensure all tests pass before requesting review.
- Do not merge without at least one approval.

---

## Security Rules

1. Never commit credentials, API keys, or secrets.
2. Never bypass authentication or authorization guards.
3. Never add `agencyId` to the request body — always derive it from the authenticated context.
4. Never expose raw database errors or stack traces in API responses.
5. Always validate and sanitize user inputs with DTOs and Zod.
6. Report security vulnerabilities privately to the maintainers — do not open a public issue.

---

## Running Tests

Before opening a pull request:

```bash
# Backend
cd backend
npm run lint
npm run test
npm run test:e2e

# Frontend
cd frontend
npm run lint
npm run test
```

---

## Adding a New Feature

1. Check if the feature is within the Sales Pipeline & Deal Management scope.
2. Design the database schema change (Prisma migration required).
3. Implement the NestJS service, DTO, controller, and guard.
4. Implement the frontend page/component using the design system tokens.
5. Write unit, integration, and e2e tests.
6. Update the relevant `docs/` files.
7. Open a pull request against `develop`.

---

## Contact

For questions, open a GitHub Discussion or contact the Neirah Tech engineering team.
