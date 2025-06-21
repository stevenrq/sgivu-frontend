# SGIVU Frontend

This project is the **Angular frontend** for the SGIVU platform. It provides a modern, responsive user interface for interacting with SGIVU's microservices, including authentication, dashboards, and user management.

## Overview

The SGIVU Frontend is a single-page application (SPA) built with Angular. It communicates with backend microservices (SGIVU User, SGIVU Auth, Gateway, etc.) via REST APIs and OAuth2/OIDC authentication. The app features modular architecture, reusable components, and robust error handling for a seamless user experience.

## DeepWiki

Access the [DeepWiki](https://deepwiki.com/stevenrq/sgivu-frontend) for detailed documentation, architecture diagrams, and advanced usage examples.

## Features

- User authentication with OAuth2/OIDC (Authorization Code Flow)
- Protected routes and role-based access control
- Responsive dashboard with charts and widgets
- Modular architecture with reusable components (navbar, sidebar, etc.)
- Error handling for forbidden and not-found routes
- Integration with backend microservices via REST APIs
- HTTP interceptors for token management and error handling
- Environment-based configuration for API endpoints
- Unit and E2E testing with Angular CLI

## Project Structure

```
src/
  app/
    core/              # Core services, guards, interceptors, and authentication logic
    features/          # Feature modules (dashboard, home, user, etc.)
    shared/            # Shared components (navbar, sidebar, widgets, etc.)
  assets/              # Static assets (images, icons, etc.)
  styles.css           # Global styles
  index.html           # Main HTML entry point
```

## Configuration

- **OAuth2/OIDC:** [`src/app/core/auth-config.ts`](src/app/core/auth-config.ts)
- **Resource server & HTTP:** [`src/app/core/auth-module-config.ts`](src/app/core/auth-module-config.ts)
- **Routing:** [`src/app/app.routes.ts`](src/app/app.routes.ts)
- **Global styles:** [`src/styles.css`](src/styles.css)

## Running Locally

1. Ensure Node.js (v18+) and npm are installed.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Start the development server:

   ```powershell
   npm start
   # or
   ng serve
   ```

4. Open [http://localhost:4200/](http://localhost:4200/) in your browser.

## Building for Production

Build the project for production deployment:

```powershell
ng build --configuration production
```

The output will be in the `dist/` directory.

## Testing

- **Unit tests:**
  ```powershell
  npm test
  # or
  ng test
  ```
- **Linting:**
  ```powershell
  ng lint
  ```
- **E2E tests:** (if configured)
  ```powershell
  ng e2e
  ```

## Troubleshooting

- Common issues include:
  - App not starting (check Node.js version, dependencies, and config files)
  - API errors (verify backend services and API URLs)
  - Authentication failures (review OAuth2/OIDC config and backend status)
  - CORS issues (update backend CORS settings)

## Code Reference

- **Authentication service:** [`src/app/core/services/auth.service.ts`](src/app/core/services/auth.service.ts)
- **Main app component:** [`src/app/app.component.ts`](src/app/app.component.ts)
- **Dashboard:** [`src/app/features/dashboard/components/dashboard/dashboard.component.ts`](src/app/features/dashboard/components/dashboard/dashboard.component.ts)
- **Shared components:** [`src/app/shared/components/`](src/app/shared/components/)

## Best Practices

- Use Angular CLI for generating components, services, and modules.
- Keep dependencies up to date (`npm outdated`, `npm update`).
- Use environment variables for sensitive configuration.
- Write and maintain unit tests for all components and services.
- Follow Angular style guide for code structure and naming.
- Use HTTP interceptors for authentication and error handling.

## License

This project is licensed under the Apache License 2.0.
