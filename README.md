# sgivu-frontend - SGIVU

## Descripción

**`sgivu-frontend`** es la aplicación Single Page (SPA) cliente del ecosistema **SGIVU**, implementada en Angular. Proporciona la interfaz de usuario para administración (dashboards, gestión de clientes, usuarios, vehículos y contratos de compra/venta) y delega la autenticación y APIs al gateway (`sgivu-gateway`).

## Tecnologías y Dependencias

- Angular 21 (standalone components, OnPush, lazy loading; sin NgModules)
- TypeScript ~5.9
- Bootstrap 5.3 + Bootstrap Icons 1.13
- Chart.js 4.5 + ng2-charts 8 (controllers tree-shaken: line/bar/doughnut)
- RxJS 7.8 + Signals (estado reactivo, sin NgRx)
- SweetAlert2 11 (modales/toasts)
- Localización: `es-CO` única (sin infraestructura i18n; labels hardcoded en español)
- Autenticación: BFF puro vía `sgivu-gateway` (sin librerías cliente OAuth tipo `angular-oauth2-oidc`)
- Herramientas de desarrollo: `@angular/cli` 21, `karma`/`jasmine` 5, `eslint` 9 + angular-eslint, `prettier` 3, `puppeteer` (para `npm run test:wsl`)

## Requisitos Previos

- Node.js (versión compatible con Angular 21)
- npm 8+ (se usa `package-lock.json`)
- `sgivu-config`, `sgivu-discovery`, `sgivu-gateway` y `sgivu-auth` disponibles (o arrancados via `infra/compose/sgivu-docker-compose`)

## Arranque y Ejecución

### Desarrollo

1. Instalar dependencias y arrancar el servidor de desarrollo:

   `npm install`
   `npm run start`  (dev server - por defecto en el puerto 4200)

2. Durante el desarrollo la configuración de entorno usada por defecto es `src/environments/environment.development.ts`.

### Ejecución Local (build)

`npm run build` — genera los assets en `dist/sgivu-frontend`.

## Despliegue

- Recomendación de despliegue: compilar la SPA (`npm run build`) y servir los archivos estáticos desde S3 + CloudFront (o un Nginx) como se hace en `infra/nginx` (actualmente la infra apunta a `sgivu-frontend.s3-website-us-east-1.amazonaws.com`).

## Producción

- Build optimizado: `npm run build -- --configuration production` (o usar la configuración por defecto para producción del builder de Angular).
- Servir `dist/sgivu-frontend` desde un CDN o un servidor estático (S3 + CloudFront es la opción utilizada por la infraestructura). Asegurar que `base href` y `routing` funcionan correctamente detrás del proxy.

## Endpoints / Integraciones

- BFF / Gateway: la app comunica con el backend a través de la URL configurada en `environment.apiUrl` (el gateway expone `/auth/session`, `/oauth2/authorization/sgivu-gateway`, `/logout` y proxifica las APIs `/v1/*`).
- Autenticación: el flujo de login se delega al gateway (Authorization Code + PKCE manejado en el gateway). La app consulta `/auth/session` para hidratar el `AuthService` (signals `isAuthenticated`, `currentAuthenticatedUser`, `rolesAndPermissions`, `admin`).
- Interceptor único: `defaultOAuthInterceptor` añade `withCredentials: true` y maneja 401 redirigiendo al flujo de login (con exenciones para `/auth/session` y `/logout`).
- Keep-alive: la SPA hace ping a `/auth/session` cada 20 minutos mientras la pestaña está visible para mantener el TTL deslizante de Redis.

## Features (rutas)

- `/dashboard` — KPIs, gráficos (Chart.js), módulo ML (predicción + retrain con timeout 30 min, métricas RMSE/MAE/MAPE/**WAPE**/R² + baselines, persistencia local con clave `dashboard:lastPrediction`).
- `/users`, `/users/profile`, `/roles-permissions` — gestión de usuarios y roles.
- `/clients/persons/...`, `/clients/companies/...` — gestión dual de clientes.
- `/vehicles/cars/...`, `/vehicles/motorcycles/...` — inventario con S3 presigned URLs.
- `/purchase-sales/...` — contratos (lista, registro, detalle).
- `/reports` — 4 pestañas analíticas (financiero, inventario, ventas-clientes, rentabilidad) con export PDF/Excel/CSV y `DataTableComponent` reutilizable.
- `/settings`, `/forbidden`, `/not-found` — utilidades.

## Seguridad

- La aplicación no maneja directamente secretos; la autenticación es delegada a `sgivu-gateway` / `sgivu-auth`.
- Variables de entorno leídas desde `src/environments/*.ts`: `apiUrl`, `issuer`, `clientId` (configuración por entorno). No incluir valores secretos en el repositorio.

## Observabilidad

- El servicio BFF (`sgivu-gateway`) proporciona trazabilidad y endpoints que la UI consume (p. ej. `/auth/session`).

## Pruebas

- Unit tests: `npm run test` (Karma + Jasmine, ~54 specs).
- Tests headless en WSL: `npm run test:wsl` (usa Puppeteer + ChromeHeadlessNoSandbox).

  > **WSL — librerías requeridas:** El Chromium de Puppeteer necesita librerías del sistema que pueden no estar presentes. Si el test falla con `error while loading shared libraries`, instálalas con:
  >
  > ```bash
  > sudo apt-get install -y libnspr4 libnss3 libasound2t64 libatk1.0-0 \
  >   libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 \
  >   libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
  >   libpango-1.0-0 libcairo2
  > ```
  >
  > En Ubuntu 22.04 reemplaza `libasound2t64` por `libasound2`.
- Lint: `npm run lint`.
- No hay tests E2E (Cypress/Playwright) configurados por defecto.

## Solución de Problemas

- Problema: 401/403 en peticiones XHR -> Verificar que `apiUrl` apunta al `sgivu-gateway` correcto y que la sesión está creada (`/auth/session`).
- Problema: Issuer / redirect mismatch -> revisar configuración de `issuer` y la configuración de `ISSUER_URL` en `sgivu-auth` / Nginx.
- Problema: Rutas no encontradas tras deploy estático -> comprobar `base href` en `index.html` y reglas de reescritura del servidor (serve index.html para rutas SPA).

## Contribuciones

1. Fork → branch → PR
2. Añadir tests para cambios funcionales y describir el cambio en el PR
