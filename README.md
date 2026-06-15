# sgivu-frontend - SGIVU

[![CI](https://github.com/stevenrq/sgivu-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenrq/sgivu-frontend/actions/workflows/ci.yml)

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
- Herramientas de desarrollo: `@angular/cli` 21, `vitest` 4 + jsdom, `eslint` 9 + angular-eslint, `prettier` 3, husky + lint-staged + commitlint

## Requisitos Previos

- Node.js (versión compatible con Angular 21)
- npm 8+ (se usa `package-lock.json`)
- `sgivu-config`, `sgivu-discovery`, `sgivu-gateway` y `sgivu-auth` disponibles (o arrancados via `infra/compose/sgivu-docker-compose`)
- En Windows, trabajar dentro de **WSL** (Linux): el entorno de desarrollo del frontend y del backend se ejecuta en WSL

## Arranque y Ejecución

### Desarrollo

1. Instalar dependencias y arrancar el servidor de desarrollo:

   `npm install`
   `npm run start` (dev server - por defecto en el puerto 4200)

2. Durante el desarrollo la configuración de entorno usada por defecto es `src/environments/environment.development.ts`.

### Ejecución Local (build)

`npm run build` — genera los assets en `dist/sgivu-frontend`.

## Despliegue

- Recomendación de despliegue: compilar la SPA (`npm run build`) y servir los archivos estáticos desde un hosting estático en la nube (S3 + CloudFront, Vercel, Netlify, AWS Amplify, etc.) o un Nginx, como se hace en `infra/nginx` (actualmente la infra apunta a `sgivu-frontend.s3-website-us-east-1.amazonaws.com`).
- El backend en producción corre en una instancia única de **AWS EC2** con Docker Compose y Nginx (ver repo [sgivu](https://github.com/stevenrq/sgivu)).

## Producción

- Build optimizado: `npm run build` (la configuración por defecto es `production`; para desarrollo usar `npm run watch` o `--configuration development`).
- Servir `dist/sgivu-frontend` desde un CDN o un hosting estático (S3 + CloudFront es la opción utilizada actualmente por la infraestructura; Vercel, Netlify o AWS Amplify son alternativas válidas). Asegurar que `base href` y `routing` funcionan correctamente detrás del proxy.

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

- Unit tests: `npm run test` (Vitest + jsdom vía `@angular/build:unit-test`; watch en TTY, una pasada en CI).
- Cobertura: `npm run test:coverage` (`@vitest/coverage-v8`).
- Los tests corren en Node sin navegador: no requieren Chrome ni configuración especial en WSL.
- Lint: `npm run lint`.
- E2E: `npm run e2e` (Playwright; levanta `ng serve` automáticamente y simula toda la red del
  gateway con `page.route()`, por lo que no necesita backend). Incluye escaneo de accesibilidad
  con axe-core. Para validar contra el stack real, levantar gateway+auth con Docker y recorrer
  los flujos manualmente (el login OAuth no es automatizable headless).

## Documentación

La documentación técnica de este proyecto está construida con Mintlify y se encuentra en `docs/`. Se consulta en local — la capa gratuita de Mintlify solo permite un sitio desplegado, que es el de la plataforma backend en [sgivu.mintlify.app](https://sgivu.mintlify.app).

```bash
npm i -g mint   # instalar CLI (una vez)
cd docs
mint dev        # preview en http://localhost:3000
```

Para el catálogo técnico de clases y APIs (Compodoc):

```bash
npm run docs:serve   # genera y sirve en http://localhost:8080
```

## Solución de Problemas

- Problema: 401/403 en peticiones XHR -> Verificar que `apiUrl` apunta al `sgivu-gateway` correcto y que la sesión está creada (`/auth/session`).
- Problema: Issuer / redirect mismatch -> revisar configuración de `issuer` y la configuración de `ISSUER_URL` en `sgivu-auth` / Nginx.
- Problema: Rutas no encontradas tras deploy estático -> comprobar `base href` en `index.html` y reglas de reescritura del servidor (serve index.html para rutas SPA).

## Contribuciones

1. Fork → branch → PR
2. Añadir tests para cambios funcionales y describir el cambio en el PR
