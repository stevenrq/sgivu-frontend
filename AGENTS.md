# Repository Guidelines

## Project Structure & Module Organization

- Angular 20 app lives in `src/app`, organized by domain under `features/` (auth, dashboard, users, vehicles, clients, purchase-sales) and reusable pieces in `shared/` (components, services, directives, pipes, validators, styles).
- Environment configs are in `src/environments/` (`environment.development.ts` for local, `environment.ts` for prod). Update API and OAuth values there only.
- Global entry points: `src/main.ts`, routes in `src/app/app.routes.ts`, app-level config in `src/app/app.config.ts`, and base styles in `src/styles.css`. Built assets emit to `dist/sgivu-frontend/browser/`.

## Build, Test, and Development Commands

- `npm install` — install dependencies.
- `npm start` — dev server at `http://localhost:4200/` with live reload.
- `npm run build` — production build to `dist/sgivu-frontend/browser/`.
- `npm run watch` — rebuild on change using the development configuration.
- `npm test` — run Jasmine + Karma specs; keep it green before raising a PR.

## Coding Style & Naming Conventions

- Use TypeScript strictness defaults; prefer Angular standalone components and signals for state.
- File names are kebab-case (`user-list.component.ts`); classes/interfaces/types use PascalCase, observables end with `$`, and services end with `Service`.
- Keep templates lean; move business logic to services in `shared/services` or the relevant feature service. Favor `readonly` signals and typed DTOs from `shared/models` or `shared/interfaces`.
- Format with Prettier 3.5 (`npx prettier --check "src/**/*.{ts,html,css}"`). Indentation: 2 spaces; keep imports sorted logically (Angular, third-party, local).

## Testing Guidelines

- Place unit tests next to code as `*.spec.ts`. Cover guards, interceptors, and services that orchestrate API calls or permissions.
- Stub OAuth/token flows via Angular testing utilities; avoid hitting real endpoints. Add component tests for shared UI with inputs/outputs and permission-bound rendering.
- Run `npm test` locally; aim to keep coverage consistent with existing specs before merging.

## Commit & Pull Request Guidelines

- Follow the existing Conventional-Commit style seen in history (`feature: …`, `refactor: …`, `chore: …`). Scope optional but helpful (e.g., `feature(auth): handle silent refresh errors`).
- PRs should include: purpose summary, linked issue if any, screenshots/GIFs for UI changes (desktop + mobile), and a list of commands run (`npm test`, build).
- Keep PRs focused per feature/bug; update related docs or environment notes when changing config-sensitive code.

## Security & Configuration Tips

- Never commit secrets. Only adjust URLs/client IDs in `src/environments/*.ts`; production values should come from your deployment pipeline.
- OAuth settings are consumed by `src/app/features/auth/config/auth-config.ts`; validate scopes and redirect URIs match the identity provider configuration.
