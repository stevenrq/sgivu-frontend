# sgivu-frontend — Instrucciones para Agentes de IA

## Descripción del Proyecto

**`sgivu-frontend`** es la SPA (Single Page Application) del ecosistema **SGIVU**, construida con **Angular 21**. Proporciona la interfaz de usuario para administración (dashboards, gestión de usuarios, clientes, vehículos, contratos de compra/venta y reportes) y delega autenticación, autorización y APIs al backend `sgivu-gateway` (BFF).

- Repositorio backend (microservicios Java/Spring Cloud + FastAPI ML): <https://github.com/stevenrq/sgivu>
- Este repo contiene **únicamente** el frontend; no incluye Docker, CI/CD ni infraestructura del backend.

## Stack

- **Angular 21.0.5** — standalone components (sin NgModules), lazy loading, signals
- **TypeScript 5.9** — `strict`, `strictTemplates`, `strictInjectionParameters`, `noPropertyAccessFromIndexSignature`, `target: ES2022`
- **Bootstrap 5.3.8** + **Bootstrap Icons 1.13.1**
- **Chart.js 4.5.1** + **ng2-charts 8** (registrables tree-shaken: line / bar / doughnut)
- **RxJS 7.8** + **Signals** (estado reactivo; sin NgRx)
- **SweetAlert2 11** (modales y toasts)
- **Karma 6.4** + **Jasmine 5.13**
- **ESLint 9** + **angular-eslint 21** + **Prettier 3.7**
- **Puppeteer 24** (para `npm run test:wsl`)
- **Localización**: `es-CO` única (sin infraestructura i18n; labels hardcoded en español)

## Entorno de Desarrollo

- Linux es el entorno principal.

> **WSL**: los tests de Angular (Karma + Chrome) pueden fallar por restricciones de sandbox de Chromium. Usar `npm run test:wsl`, que arranca Karma en modo `headless` con `ChromeHeadlessNoSandbox` usando el Chromium integrado de Puppeteer.
>
> Si Puppeteer falla con `error while loading shared libraries`, instalar:
>
> ```bash
> sudo apt-get install -y libnspr4 libnss3 libasound2t64 libatk1.0-0 \
>   libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 \
>   libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
>   libpango-1.0-0 libcairo2
> ```
>
> En Ubuntu 22.04 reemplazar `libasound2t64` por `libasound2`.

## Comandos Esenciales

```bash
npm install
npm run start       # ng serve, puerto 4200 (usa environment.development.ts)
npm run build       # output en dist/sgivu-frontend
npm run watch       # ng build --watch --configuration development
npm run test        # Karma + Jasmine en watch mode
npm run test:wsl    # headless Puppeteer (ChromeHeadlessNoSandbox)
npm run lint        # angular-eslint
```

## Configuración por Entornos

Archivos en [src/environments/](src/environments/):

- `environment.ts` — producción
- `environment.development.ts` — desarrollo (usado por `ng serve`)
- `environment.example.ts` / `environment.development.example.ts` — plantillas versionadas

Variables: `apiUrl`, `issuer`, `clientId`. **No incluir secretos**: la autenticación se delega íntegramente al gateway.

## Arquitectura

### Estructura de `src/`

```text
src/
├── app/
│   ├── app.config.ts, app.routes.ts, app.component.{ts,html,css}
│   ├── features/
│   │   ├── auth/           # services, guards, interceptors, components (login, callback)
│   │   ├── dashboard/      # components, services (demand-prediction), models, utils
│   │   ├── users/          # user.routes.ts + components, services, resolvers, utils
│   │   ├── clients/        # client.routes.ts + person-list, company-list, client-detail, client-form
│   │   ├── vehicles/       # vehicle.routes.ts + car-list, motorcycle-list, vehicle-detail, vehicle-form
│   │   ├── purchase-sales/ # purchase-sales.routes.ts + list, create, detail, vehicle-form
│   │   └── reports/        # reports.routes.ts + 4 tabs (financial, inventory, sales-clients, profitability)
│   └── shared/
│       ├── components/     # 15+ reutilizables (ver tabla)
│       ├── services/       # theme, toast, confirm-action, *-ui-helper
│       ├── directives/     # has-permission, row-navigate
│       ├── pipes/          # cop-currency, utc-to-gmt-minus5
│       ├── validators/     # form.validator
│       ├── models/, interfaces/, utils/, styles/
├── environments/
├── styles.css, styles/, types/
└── main.ts, index.html
```

### Principios Arquitectónicos

- **Standalone components** (sin NgModules, sin `bootstrap.module.ts`).
- **Lazy loading por feature** — cada feature expone su propio `<feature>.routes.ts`.
- **`ChangeDetectionStrategy.OnPush` obligatorio** en todos los componentes nuevos.
- **Signals como única fuente de verdad** para estado (sin NgRx, sin `BehaviorSubject` como state).
- **Preparado para Zoneless** — ver nota en [src/app/app.config.ts](src/app/app.config.ts) (lista de propiedades mutables pendientes de convertir a signal).

## Convenciones de Código

### Componentes

- Selector prefijo `app-` (kebab-case); directivas con prefijo `app` (camelCase).
- `ChangeDetectionStrategy.OnPush`.
- Inputs/outputs funcionales (`input()`, `output()`) de Angular 18+ donde sea posible.
- Templates con `*ngIf` están permitidos (regla `@angular-eslint/template/prefer-control-flow` está desactivada).

### Servicios y Estado con Signals

```ts
private readonly _users = signal<User[]>([]);
readonly users = this._users.asReadonly();
readonly activeUsers = computed(() => this._users().filter(u => u.enabled));
```

- `toSignal()` / `toObservable()` para interoperar con RxJS.
- Servicios `providedIn: 'root'` por defecto.
- Exponer signals **de solo lectura** (`asReadonly()` o `computed()`); el signal mutable es privado.

### Autenticación (BFF puro)

- **Sin** librerías OAuth cliente (no `angular-oauth2-oidc`, no `oidc-client`). Todo el flujo OAuth2.1/PKCE vive en el gateway.
- `defaultOAuthInterceptor` añade `withCredentials: true` y maneja `401` redirigiendo al flujo de login (excepciones: `/auth/session`, `/logout`).
- `AuthService.initializeAuthentication()` se ejecuta vía `provideAppInitializer` en [src/app/app.config.ts](src/app/app.config.ts).
- **Keep-alive**: ping a `/auth/session` cada 20 min mientras la pestaña está visible (mantiene TTL deslizante de la sesión en el gateway).

Endpoints consumidos del gateway:

| Endpoint | Uso |
| --- | --- |
| `/auth/session` | Hidratar usuario autenticado (signals `isAuthenticated`, `currentAuthenticatedUser`, `rolesAndPermissions`) |
| `/oauth2/authorization/sgivu-gateway` | Iniciar login |
| `/logout` | Cerrar sesión |
| `/v1/*` | APIs de negocio (usuarios, clientes, vehículos, compras/ventas, reportes, ML) |

### Autorización (RBAC)

- Formato de permisos: `"recurso:accion"` (e.g., `user:create`, `vehicle:delete`, `car:read`).
- `PermissionService.hasPermission()` aplana User → Roles → Permissions y retorna `Observable<boolean>`.
- **Guards**:
  - `authGuard` — espera `isDoneLoading$` antes de validar autenticación.
  - `permissionGuard` — lee `data.canActivateFn` de la ruta; redirige a `/forbidden` si falla (fail-secure).
- **Directiva**: `*appHasPermission="'user:create'"` o `*appHasPermission="['p1','p2']; logic: 'AND'"` (lógica `OR` por defecto).

### Reactive Forms

- Tipado fuerte: `FormGroup<FormControls>`.
- Validators personalizados en [src/app/shared/validators/form.validator.ts](src/app/shared/validators/form.validator.ts):
  - `lengthValidator(min, max)`
  - `noWhitespaceValidator()`
  - `noSpecialCharactersValidator()`
  - `passwordStrengthValidator()` — mayús + minús + dígito + especial, mín. 6
  - Presets: `textFieldValidators(min, max)`, `numericFieldValidators(min, max)`

### Componentes Compartidos (`src/app/shared/components/`)

`data-table`, `pager`, `kpi-card`, `page-header`, `form-shell`, `navbar`, `sidebar`, `loading-overlay`, `skeleton`, `filter-chip-group`, `range-input`, `quick-search-bar`, `settings`, `configuration`, `forbidden`, `not-found`.

**Reutilizar antes de crear**. `DataTableComponent` es genérico (inputs: `striped`, `compact`, `stickyHeader`, `maxHeight`, `flat`, `tableClass`, skeleton loader integrado).

### Utilidades Compartidas (`src/app/shared/utils/`)

| Archivo | Función |
| --- | --- |
| `crud-operations.factory.ts` | CRUD genérico (create/read/update/delete/count) parametrizado por feature |
| `list-page-manager.ts` | Estado reutilizable de listas paginadas con filtros |
| `filter-query.utils.ts` (`buildSearchParams`) | Conversión filtros ↔ `HttpParams` |
| `form.utils.ts` | Helpers para Reactive Forms |
| `currency.utils.ts` + `cop-currency.pipe.ts` | Formato COP |
| `date.utils.ts` + `utc-to-gmt-minus5.pipe.ts` | Fechas y zona horaria local |
| `error-handler.utils.ts` | Tratamiento centralizado de errores HTTP |
| `swal-alert.utils.ts` | Helpers SweetAlert2 |
| `address-form.utils.ts`, `quick-search.utils.ts`, `vehicle-status-labels.utils.ts` | Helpers por dominio |

### Theming (Light / Dark)

- `ThemeService` gestiona preferencia (`light` / `dark` / `system`) con signals.
- Persistencia en `localStorage` clave `sgivu-theme`.
- Aplicación al DOM vía atributo `data-theme` en `<html>`.
- Listener de `prefers-color-scheme` para modo `system`.
- CSS custom properties en `:root` y `:root[data-theme="dark"]`; mapeo a variables de Bootstrap 5.3.
- `ToastService` toma colores del tema activo.

## Rutas Principales

| Ruta | Guards | Notas |
| --- | --- | --- |
| `/dashboard` | `authGuard` + `permissionGuard` | KPIs, gráficos Chart.js, módulo ML |
| `/users/*`, `/roles-permissions` | `authGuard` + `permissionGuard` | Lazy |
| `/clients/persons/*`, `/clients/companies/*` | `authGuard` + `permissionGuard` | Lazy, gestión dual de clientes |
| `/vehicles/cars/*`, `/vehicles/motorcycles/*` | `authGuard` + `permissionGuard` | Lazy, S3 presigned URLs |
| `/purchase-sales/*` | `authGuard` + `permissionGuard` | Lazy, contratos |
| `/reports` | `authGuard` + `permissionGuard` | 4 tabs: financiero, inventario, ventas-clientes, rentabilidad; export PDF/Excel/CSV |
| `/login`, `/callback` | — | Flujo OAuth |
| `/settings`, `/forbidden`, `/not-found` | — | Utilidades |

## Dashboard / ML

- `DemandPredictionService` consume `/v1/ml/*` vía gateway.
- Timeout de retrain: **30 min** (alineado con el `mlRetrainCircuitBreaker` del gateway).
- Métricas mostradas: **RMSE, MAE, MAPE, WAPE, R²** + baselines.
- Persistencia local de la última predicción: `localStorage["dashboard:lastPrediction"]`.

## Despliegue

- Build: `npm run build` → `dist/sgivu-frontend`.
- Servir como SPA estática desde **S3 + CloudFront** (recomendado) o Nginx.
- Asegurar **reescritura de rutas SPA a `index.html`** y `base href="/"`.
- Sin Docker, sin CI/CD configurados en este repo.

## Solución de Problemas

- **401/403 en peticiones XHR** → Verificar que `apiUrl` apunta al gateway correcto y que existe sesión (`/auth/session`).
- **Issuer / redirect mismatch** → Revisar `issuer` en environment y configuración del backend.
- **Rutas 404 tras deploy estático** → Configurar reescritura de rutas SPA a `index.html`.
- **Tests fallan en WSL** → Usar `npm run test:wsl`; instalar librerías de Chromium si Puppeteer reporta `error while loading shared libraries`.
- **Acceso local con `sgivu-auth`** → Agregar `sgivu-auth` a `/etc/hosts` apuntando a `127.0.0.1`.

## Reglas de Generación y Modificación de Código

Sigue estrictamente estas reglas al generar o modificar código.

### Idioma

- **Código fuente** (clases, métodos, variables, archivos, logs, excepciones): **INGLÉS**.
- **Comentarios y documentación**: **ESPAÑOL**.
- **Textos visibles para el usuario** (UI, mensajes, validaciones, respuestas de error): **ESPAÑOL**.

### Pruebas

- `describe()` e `it()` (Jasmine): **ESPAÑOL**.
- Nombres de métodos/funciones de test: **INGLÉS**.

### Regla Base

> Lo que lee un humano → español.
> Lo que ejecuta la máquina → inglés.

### Calidad de Código

- Aplicar **SOLID**, **Clean Code** y **DRY**.
- Una sola responsabilidad por clase/servicio.
- Métodos pequeños y legibles.
- No usar valores mágicos ni lógica hardcodeada.
- **Reutilizar utilidades existentes** en `src/app/shared/utils/` antes de crear nuevas.
- **Reutilizar componentes existentes** de `src/app/shared/components/` antes de crear nuevos.

### Errores y Logs

- Mensajes de error al usuario: **español** (vía `ToastService` o SweetAlert2).
- Logs y errores técnicos internos: **inglés**.
- No exponer detalles técnicos al usuario.

### Nomenclatura de Pruebas

Patrón común: **resultado esperado + condición**. Agrupar tests por método con `describe` anidados.

**Angular (Jasmine)** — Archivos: `<archivo>.spec.ts`:

```ts
describe('UserService', () => {
  describe('create()', () => {
    it('Debe crear usuario y agregarlo al estado', () => {});
    it('Debe propagar error y no modificar el estado', () => {});
  });

  describe('update()', () => {
    it('Debe actualizar usuario en el estado', () => {});
    it('Debe no alterar estado si el usuario no existe', () => {});
  });
});
```

**Reglas generales**:

- Describir **comportamiento**, no implementación (`shouldMapDtoToEntityCorrectly` ✅, `testMapper` ❌).
- Un test = una expectativa clara. Si el nombre tiene "and", probablemente son dos tests.
- Ser consistente: elegir un estilo y no mezclarlo.
- El nombre debe explicar el _por qué_ del fallo: qué se rompió y en qué escenario.

### Git

- Commits en **inglés**, siguiendo **Conventional Commits** y **Gitflow**.
- Commits pequeños y atómicos.
- Ramas con nombres claros: `main`, `develop`, `feature/`, `release/`, `hotfix/`, `fix/`, `refactor/`, `chore/`.
