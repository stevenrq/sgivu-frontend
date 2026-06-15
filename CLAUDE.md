# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Descripción del Proyecto

**`sgivu-frontend`** es la SPA del ecosistema **SGIVU**, construida con **Angular 21**. Proporciona la interfaz de administración (dashboards, usuarios, clientes, vehículos, contratos de compra/venta y reportes) y delega autenticación, autorización y APIs al backend `sgivu-gateway` siguiendo el patrón **BFF**.

- Repositorio backend (microservicios Java/Spring Cloud + FastAPI ML): <https://github.com/stevenrq/sgivu>
- Este repo contiene **únicamente** el frontend; sin Docker ni infraestructura del backend. CI vía GitHub Actions (`.github/workflows/ci.yml`).

## Entornos

- **Desarrollo**: Windows con **WSL** (Linux), tanto para este frontend como para el backend. Todos los comandos (`npm`, `npx`) se ejecutan dentro de WSL.
- **Producción**: el frontend se despliega en un hosting estático en la nube (S3 + CloudFront, Vercel, Netlify, AWS Amplify, etc.); el backend corre en una instancia única de **AWS EC2** con Docker Compose y Nginx.
- Los tests unitarios corren en **Node + jsdom** (Vitest): no requieren Chrome ni configuración especial en WSL.
- Backend local: Docker Compose del repo `sgivu` (`infra/compose/sgivu-docker-compose`) — gateway en :8080, auth en :9000.

## Comandos Esenciales

```bash
npm run start          # ng serve :4200 (usa environment.development.ts)
npm run test           # Vitest + jsdom (watch en TTY; una pasada en CI/no-TTY)
npm run test:coverage  # Vitest con cobertura (umbrales en angular.json)
npm run e2e            # Playwright smoke suite — levanta ng serve solo; red del gateway simulada con page.route(), NO requiere backend
npm run lint           # angular-eslint
npm run build          # build producción → dist/sgivu-frontend (budgets como gate)
npm run docs:serve     # Compodoc en :8080 (catálogo de componentes/servicios; compodoc/ no se versiona)
```

> **Playwright en WSL/Ubuntu 26.04**: si `npx playwright install chromium` falla con
> "does not support chromium on ubuntu26.04", instalar con
> `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium`.

**Notas para agentes:** CI ejecuta Prettier check → lint → Vitest → build prod → e2e. Node fijado en `.nvmrc` (v24). El hook `pre-commit` (husky + lint-staged) puede reformatear archivos al commitear; si un commit falla por reformateo, hacer `git add -u` y reintentar.

## Configuración por Entornos

Archivos en `src/environments/`:

- `environment.ts` — producción
- `environment.development.ts` — desarrollo (usado por `ng serve`)
- `environment.example.ts` / `environment.development.example.ts` — plantillas versionadas

Los archivos reales están **gitignorados**; se generan desde las plantillas. Variables: `apiUrl`, `authHealthCheckUrl`, `clientId`. **No incluir secretos**: la autenticación se delega íntegramente al gateway.

> ⚠ `environment.ts` de prod apunta a una URL `http://` (EC2 sin TLS). No cambiar `apiUrl`/`authHealthCheckUrl` sin coordinar con el backend (la corrección es habilitar TLS en el gateway, repo infra).

## Arquitectura

Reglas obligatorias:

- **Standalone components** (sin NgModules), **lazy loading por feature** — cada feature expone su `<feature>.routes.ts` bajo `src/app/features/`.
- **Zoneless** (`provideZonelessChangeDetection`, sin zone.js): `ChangeDetectionStrategy.OnPush` **obligatorio** en todo componente. Todo estado leído en plantillas debe ser reactivo (signals/`computed`/`effect`); nada de mutar propiedades planas. Estado de formularios que cambia por callbacks async → `toSignal(control.valueChanges)`.
- **Signals como única fuente de verdad** (sin NgRx, sin `BehaviorSubject` como estado).
- **Bootstrap JS por imports ESM** en `src/main.ts` (solo `dropdown` y `tab` registrados; `collapse` en el navbar). **No usar `angular.json > scripts`**. Si introduces otro componente `data-bs-*` (modal, tooltip…), importa su módulo en `main.ts` o quedará muerto en silencio.
- Localización única `es-CO`, sin infraestructura i18n; labels hardcoded en español.

### Autenticación (BFF puro)

- **Sin** librerías OAuth cliente (no `angular-oauth2-oidc`). Todo el flujo OAuth2.1/PKCE vive en el gateway.
- `defaultOAuthInterceptor` añade `withCredentials: true` y maneja `401` redirigiendo a login (excepciones: `/auth/session`, `/logout`).
- **Keep-alive**: ping a `/auth/session` cada 20 min (mantiene TTL deslizante de la sesión en el gateway).
- Endpoints del gateway: `/auth/session`, `/oauth2/authorization/sgivu-gateway`, `/logout`, `/v1/*`.

### Autorización (RBAC)

- Formato de permisos: `"recurso:accion"` (e.g., `user:create`, `vehicle:delete`, `car:read`).
- **Guards**: `authGuard` (espera `isDoneLoading$`) y `permissionGuard` (lee `data.canActivateFn`, redirige a `/forbidden`, fail-secure).
- **Directiva**: `*appHasPermission="'user:create'"` o `*appHasPermission="['p1','p2']; logic: 'AND'"` (lógica `OR` por defecto).

## Convenciones de Código

### Servicios y Estado con Signals

```ts
private readonly _users = signal<User[]>([]);
readonly users = this._users.asReadonly();
readonly activeUsers = computed(() => this._users().filter(u => u.enabled));
```

- `toSignal()` / `toObservable()` para interoperar con RxJS.
- Servicios `providedIn: 'root'` por defecto; exponer signals **de solo lectura** (`asReadonly()` o `computed()`); el signal mutable es privado.

### Componentes

- Selectores: componentes `app-` kebab-case; directivas `app` camelCase.
- `input()`/`output()` funcionales donde sea posible.
- `*ngIf` permitido (regla `@angular-eslint/template/prefer-control-flow` desactivada).
- **Reutilizar antes de crear**: componentes en `src/app/shared/components/` (`data-table`, `pager`, `kpi-card`, `page-header`, `form-shell`, `filter-chip-group`, `quick-search-bar`, `list-toolbar`, etc.) y utils en `src/app/shared/utils/` (`crud-operations.factory.ts` para CRUD genérico, `list-page-manager.ts` para listas paginadas con filtros, `form.utils.ts`, `error-handler.utils.ts`, `swal-alert.utils.ts`…). Catálogo completo: `npm run docs:serve`.

### Criterio Shared vs Feature

- **`shared/`**: solo si lo usan **≥ 2 features** o es genuinamente genérico sin conocimiento de dominio.
- **`features/<nombre>/`**: todo lo que pertenece a un solo dominio, aunque hoy lo use una sola feature.
- Mover archivos entre ambos = un único commit `refactor:` actualizando todos los imports.

### Reactive Forms

- Tipado fuerte: `FormGroup<FormControls>`.
- Validators personalizados y presets en `src/app/shared/validators/form.validator.ts` (`lengthValidator`, `noWhitespaceValidator`, `noSpecialCharactersValidator`, `passwordStrengthValidator`, `textFieldValidators`, `numericFieldValidators`) — usarlos antes de escribir validators nuevos.

### Jerarquía de Botones

| Variante                | Cuándo usar                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `btn-primary`           | CTA principal de la vista. **Solo uno por pantalla.**                  |
| `btn-outline-secondary` | Acciones secundarias o destructivas leves (Cancelar, Limpiar, Volver). |
| `btn-outline-primary`   | Navegación secundaria o acciones de detalle dentro de una tabla.       |
| `btn-outline-danger`    | Confirmación destructiva visible antes del diálogo.                    |
| `btn-outline-success`   | Acción positiva contextual (p. ej. toggle "Activar").                  |
| `btn-sm` / `btn-icon`   | Filas de tabla / icono sin texto (`btn-icon` requiere `aria-label`).   |

No usar `btn-secondary`, `btn-light` ni `btn-dark` (contraste ambiguo en modo oscuro).

### Estilos y Theming

- **Floating labels**: los formularios usan el wrapper `.floating-google` (en `styles.css`) sobre `form-floating` de Bootstrap. Mantener este enfoque; no migrar sin pruebas visuales de los 4 formularios.
- `ThemeService` (signals, `light`/`dark`/`system`), persiste en `localStorage["sgivu-theme"]`, aplica `data-theme` en `<html>`; CSS custom properties mapeadas a variables Bootstrap 5.3.

## Testing

- Setup global en `src/test-setup.ts`: stub de `window.matchMedia` (jsdom no lo implementa) y `vi.restoreAllMocks()` en `afterEach`.
- Para espiar `localStorage`/`sessionStorage` usar `vi.spyOn(Storage.prototype, ...)` — el Storage de jsdom es un Proxy y espiar la instancia no intercepta.
- E2E: OAuth2/BFF real no se puede automatizar headless; la suite e2e simula toda la red. Probar login real manualmente.

## Dashboard / ML

- `DemandPredictionService` consume `/v1/ml/*` vía gateway. Timeout de retrain: **30 min** (alineado con el `mlRetrainCircuitBreaker` del gateway).
- Última predicción persiste en `localStorage["dashboard:lastPrediction"]`. Métricas: RMSE, MAE, MAPE, WAPE, R².

## Despliegue

- Build: `npm run build` → `dist/sgivu-frontend`. Servir como SPA estática desde un hosting en la nube (S3 + CloudFront, Vercel, Netlify, etc.) o Nginx. Sin Docker.
- Asegurar **reescritura de rutas SPA a `index.html`** y `base href="/"`.

## Documentación (Mintlify)

El sitio de documentación vive en `docs/` (config `docs/docs.json`). Se consulta **siempre en local** — la capa gratuita de Mintlify solo permite un sitio desplegado, que es el del backend en https://sgivu.mintlify.app.

```bash
npm i -g mint        # instalar CLI (una vez)
cd docs
mint dev             # preview en http://localhost:3000
mint broken-links    # verificar enlaces rotos
```

Estructura de tabs: **Documentación** (overview, primeros pasos, features) · **Arquitectura** (zoneless/signals, standalone/lazy, auth, autorización, theming, forms) · **Componentes** (shared-components, shared-utils, validators/pipes/directivas, compodoc) · **Integración** (gateway BFF, predicción de demanda ML) · **Testing** (unitario, e2e, CI) · **Referencia** (estilo de código, git workflow, troubleshooting).

**Compodoc** es un catálogo técnico independiente (referencia de clases y APIs), no parte del sitio Mintlify:

```bash
npm run docs:serve   # genera y sirve en http://localhost:8080
```

La salida se escribe en `compodoc/` (raíz del repo, gitignoreada) — **fuera** de `docs/` a propósito: los web components de Compodoc (`compodoc-menu`) rompen el preview de Mintlify si conviven dentro de su raíz de contenido.

## Sincronización de Documentación

Al cambiar código que tiene página en `docs/`, actualizar el `.mdx` correspondiente en el mismo commit o PR.

| Qué cambió en el código                                          | Página(s) a actualizar                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Permiso nuevo/renombrado (`recurso:accion`)                      | `docs/architecture/authorization.mdx` · `docs/features/roles-permissions.mdx` · página de la feature afectada |
| Flujo de auth, interceptor o keep-alive                          | `docs/architecture/authentication.mdx`                                                                        |
| Variable de entorno (`apiUrl`, `authHealthCheckUrl`, `clientId`) | `docs/getting-started/environments.mdx`                                                                       |
| Componente o util compartido añadido/renombrado                  | `docs/components/shared-components.mdx` o `docs/components/shared-utils.mdx`                                  |
| Endpoint ML, métricas o timeout de retrain                       | `docs/integration/demand-prediction.mdx` · `docs/features/dashboard.mdx`                                      |
| Setup de tests o pipeline CI                                     | `docs/testing/unit.mdx` · `docs/testing/e2e.mdx` · `docs/testing/ci.mdx`                                      |

No documentar refactors internos sin superficie pública observable.

## Solución de Problemas

- **401/403 en peticiones XHR** → verificar que `apiUrl` apunta al gateway correcto y que existe sesión (`/auth/session`).
- **Auth health-check falla** → revisar `authHealthCheckUrl` y que el gateway esté en pie.
- **Rutas 404 tras deploy estático** → configurar reescritura de rutas SPA a `index.html`.
- **Acceso local con `sgivu-auth`** → agregar `sgivu-auth` a `/etc/hosts` apuntando a `127.0.0.1`.

## Reglas de Generación y Modificación de Código

Sigue estrictamente estas reglas al generar o modificar código.

### Idioma

- **Código fuente** (clases, métodos, variables, archivos, logs, excepciones): **INGLÉS**.
- **Comentarios y documentación**: **ESPAÑOL**.
- **Textos visibles para el usuario** (UI, mensajes, validaciones, respuestas de error): **ESPAÑOL**.

### Pruebas

- `describe()` e `it()` (Vitest): **ESPAÑOL**.
- Nombres de métodos/funciones de test: **INGLÉS**.

### Regla Base

> Lo que lee un humano → español.
> Lo que ejecuta la máquina → inglés.

### Calidad de Código

- Aplicar **SOLID**, **Clean Code** y **DRY**.
- Una sola responsabilidad por clase/servicio; métodos pequeños y legibles.
- No usar valores mágicos ni lógica hardcodeada.
- **Reutilizar** utilidades de `src/app/shared/utils/` y componentes de `src/app/shared/components/` antes de crear nuevos.

### Errores y Logs

- Mensajes de error al usuario: **español** (vía `ToastService` o SweetAlert2).
- Logs y errores técnicos internos: **inglés**.
- No exponer detalles técnicos al usuario.

### Nomenclatura de Pruebas

Patrón: **resultado esperado + condición**. Agrupar por método con `describe` anidados; archivos `<archivo>.spec.ts`:

```ts
describe("UserService", () => {
  describe("create()", () => {
    it("Debe crear usuario y agregarlo al estado", () => {});
    it("Debe propagar error y no modificar el estado", () => {});
  });
});
```

- Describir **comportamiento**, no implementación.
- Un test = una expectativa clara. Si el nombre tiene "and", probablemente son dos tests.
- El nombre debe explicar el _por qué_ del fallo: qué se rompió y en qué escenario.

### Git

- Commits en **inglés**, siguiendo **Conventional Commits** (validados con commitlint en el hook `commit-msg`).
- Commits pequeños y atómicos.
- Flujo **trunk-based**: ramas cortas desde `main` (`feature/`, `fix/`, `refactor/`, `chore/`) integradas a `main` vía PR. No existe `develop` ni ramas `release/`.
