# 🧩 SGIVU - Frontend

## 📘 Descripción

SGIVU Frontend es la interfaz principal del ecosistema SGIVU. Permite a los equipos operativos administrar usuarios, roles y permisos, visualizar indicadores de demanda y acompañar la trazabilidad de clientes y vehículos. La aplicación está orientada al uso interno y consolida en un solo panel los servicios del gateway para que la gestión diaria sea consistente con los datos del backend.

## 🧱 Arquitectura y Rol

* **Tipo:** SPA desarrollada con **Angular 20** usando componentes standalone y detección de cambios optimizada.
* **Integración:** Consume los microservicios `sgivu-user`, `sgivu-client`, `sgivu-vehicle`, `sgivu-report`, `sgivu-auth` y `sgivu-prediction` a través del API Gateway `sgivu-gateway`.
* **Autenticación y autorización:** Gestiona sesiones OAuth 2.1 / OIDC con `angular-oauth2-oidc`, conserva tokens en `localStorage` seguro y expone guards (`authGuard`, `permissionGuard`) y la directiva `appHasPermission` para proteger rutas y componentes.
* **Presentación:** Incluye un dashboard con gráficos de demanda (`ng2-charts` + `Chart.js`), componentes compartidos de navegación y un módulo de usuarios con control de estados, paginación y acciones confirmadas desde `SweetAlert2`.
* **State management:** Se usan señales nativas de Angular para mantener el estado de listas y paginadores dentro de los servicios, favoreciendo un flujo reactivo sin librerías externas.

## ⚙️ Tecnologías

* **Framework:** Angular 20 (TypeScript, standalone components, Signals API)
* **UI:** Bootstrap 5, Bootstrap Icons, CSS3 y HTML5
* **Gráficos:** Chart.js 4 + ng2-charts
* **Comunicación:** HttpClient con soporte Fetch y RxJS 7.8
* **Autenticación:** angular-oauth2-oidc, OAuth 2.1 Authorization Code + PKCE, JWT
* **Alertas y UX:** SweetAlert2
* **Calidad:** Prettier 3.5, Jasmine + Karma para pruebas unitarias

## 🚀 Ejecución Local

1. Clonar el repositorio y acceder al directorio `sgivu-frontend`.
2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Configurar los entornos en `src/environments/` (ver sección de configuración) con las URLs reales del gateway y del proveedor de identidad.
4. Levantar la aplicación en modo desarrollo:

   ```bash
   npm start
   ```

5. Abrir `http://localhost:4200` en el navegador. El Angular CLI recargará automáticamente ante cambios en el código.
6. Opcionalmente ejecutar pruebas unitarias:

   ```bash
   npm test
   ```

## 🔧 Configuración

El proyecto diferencia entornos mediante `environment.development.ts` y `environment.ts` (producción). Cada archivo debe exponer el mismo contrato:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  issuer: 'http://sgivu-auth:9000',
  clientId: 'angular-local',
};
```

* `apiUrl`: URL base del API Gateway (`/v1` en los servicios de usuarios).
* `issuer`: Proveedor de identidad (Keycloak / sgivu-auth) para discovery docs y endpoints OAuth.
* `clientId`: Identificador configurado en el proveedor para el frontend.

El archivo `src/app/features/auth/config/auth-config.ts` consume estos valores para construir el flujo OAuth2, habilitar silent refresh y declarar los alcances (`scope`). Ajusta los scopes de acuerdo al rol configurado en el backend.

## 🧩 Estructura del Proyecto

```
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── features/
│   │   │   ├── auth/           # Guards, servicios OAuth, interceptores y componentes de login/callback
│   │   │   ├── dashboard/      # Componentes de visualización de métricas y gráficos
│   │   │   ├── pager/          # Componente reutilizable de paginación
│   │   │   └── users/          # CRUD de usuarios, formulario, perfil, roles y permisos
│   │   └── shared/
│   │       ├── components/     # Navbar, sidebar, vistas de estado (forbidden, not-found, settings)
│   │       ├── directives/     # Directiva appHasPermission para controlar visibilidad por permisos
│   │       ├── interfaces/     # Contratos de tokens y DTOs
│   │       ├── models/         # Modelos de dominio (User, PaginatedResponse)
│   │       ├── services/       # Utilidades UI (SweetAlert2), orquestadores
│   │       └── validators/     # Validadores personalizados para formularios reactivos
│   ├── assets/
│   └── environments/
├── angular.json
├── package.json
└── tsconfig.json
```

## 🔐 Seguridad

* **OAuth2 + OIDC completo:** `AuthService` inicializa descubrimiento y login silencioso, conserva tokens y expone el estado de autenticación como observables.
* **Intercepción centralizada:** `defaultOAuthInterceptor` añade el `Bearer token` sólo a las URLs permitidas y relanza el flujo de login si encuentra un `401`.
* **Guardas de ruta:** `authGuard` asegura sesiones válidas y `permissionGuard` ejecuta verificaciones dinámicas mediante `PermissionService`.
* **Control granular en la vista:** La directiva `appHasPermission` controla la renderización de botones y secciones dependiendo de los permisos declarados (AND/OR).
* **Persistencia segura:** Los tokens se almacenan en `localStorage` mediante la factoría `OAuthStorage`, y se limpia el estado al cerrar sesión.

## ☁️ Despliegue en AWS

* **S3 + CloudFront:** Subir el contenido de `dist/sgivu-frontend/browser` a un bucket S3 y distribuirlo con CloudFront para cacheo perimetral y HTTPS automático.
* **Integración con backend:** Configurar en Route53 un subdominio para el frontend y asegurar que las URLs del gateway (`apiUrl`) y el issuer (`issuer`) estén expuestos tras un Application Load Balancer / API Gateway.

## 📊 Monitoreo y Logs

* Trazas en el API Gateway para correlacionar peticiones del frontend con los microservicios descendentes.

## 🧠 Buenas Prácticas

* Mantener los entornos sincronizados con los valores del backend; evita hardcodear endpoints dentro de los servicios.
* Ejecutar `npm test` y `npx prettier --check "src/**/*.{ts,html,css}"` antes de cada commit.
* Usar lazy loading en rutas de nuevas funcionalidades para conservar el peso inicial del bundle.
* Documentar componentes complejos con comentarios JSDoc y actualiza las pruebas unitarias asociadas.
* Reutilizar las señales y servicios compartidos para conservar un único origen de estados en listados y formularios.

## ✨ Autor

* **Steven Ricardo Quiñones**
* **Año:** 2025
