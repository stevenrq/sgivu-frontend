---
name: run-app
description: Levanta la app SGIVU localmente — frontend solo (con red simulada en e2e) o stack completo con backend real vía Docker Compose. Usar cuando se pida correr, arrancar o verificar la app en el navegador.
---

# Levantar sgivu-frontend

## Modo 1: solo frontend (lo habitual)

```bash
npm run start   # ng serve en http://localhost:4200
```

- Usa `environment.development.ts` (si no existe, copiarlo desde `src/environments/environment.development.example.ts`).
- Sin backend, la app carga pero `/auth/session` falla: el guard redirige al flujo de login del gateway, que no responderá. Sirve para verificar layout/estilos de rutas públicas (`/login`, `/not-found`, `/forbidden`) o trabajar con la suite e2e.
- Para verificar comportamiento sin backend, preferir `npm run e2e` (Playwright simula toda la red del gateway con `page.route()`).

## Modo 2: stack completo (backend real)

1. En el repo backend `sgivu` (hermano de este repo), levantar Docker Compose desde `infra/compose/sgivu-docker-compose`: gateway en :8080, auth en :9000.
2. Verificar que `sgivu-auth` está en `/etc/hosts` apuntando a `127.0.0.1`.
3. `npm run start` y abrir http://localhost:4200 — el login OAuth2 real funciona solo en este modo (no es automatizable headless).

## Verificación rápida

- App arriba: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200` → 200.
- Sesión backend: `curl -s http://localhost:8080/auth/session` (401 sin login es respuesta sana del gateway).
