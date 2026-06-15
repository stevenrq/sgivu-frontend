---
name: ci-check
description: Replica localmente el pipeline de CI (Prettier check, lint, Vitest, build de producción y opcionalmente e2e) antes de hacer push. Usar cuando se pida validar que la rama pasará CI.
---

# Replicar CI localmente

Ejecutar en este orden (el mismo de `.github/workflows/ci.yml`), deteniéndose en el primer fallo:

```bash
npx prettier --check .
npm run lint
npx ng test --watch=false --coverage
npm run build
```

- Si faltan los environments (gitignorados), generarlos primero desde las plantillas: copiar `src/environments/environment.example.ts` → `environment.ts` y `environment.development.example.ts` → `environment.development.ts`.
- La cobertura tiene umbrales en `angular.json` (statements 47%, branches 51%, functions 58%, lines 50%): si bajan, CI falla.
- El build de producción usa budgets como gate: revisar el tamaño reportado si falla.

Solo si el cambio toca flujos cubiertos por e2e (listas, formularios, accesibilidad) o a petición del usuario:

```bash
npm run e2e
```

(En WSL/Ubuntu 26.04, si falta Chromium: `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium`.)

Reportar al final un resumen: qué pasos pasaron, cuál falló y el error relevante.
