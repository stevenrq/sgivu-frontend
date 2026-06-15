# Documentación de sgivu-frontend

Este directorio contiene la documentación oficial de `sgivu-frontend` construida con [Mintlify](https://mintlify.com).

## Contenido

- Guías de instalación y configuración de entornos
- Arquitectura: zoneless, signals, BFF y lazy loading
- Catálogo de componentes y utilidades compartidas
- Integración con el gateway y el servicio ML
- Testing: Vitest, Playwright y pipeline CI
- Referencia: estilo de código, git workflow y troubleshooting

## Desarrollo Local

Instala la CLI de Mintlify:

```bash
npm i -g mint
```

Desde este directorio (`docs/`):

```bash
mint dev
```

La documentación queda disponible en `http://localhost:3000`.

## Validación

```bash
# Verificar enlaces rotos
mint broken-links

# Build completo (valida la estructura)
mint build
```

## Publicación

Los cambios se publican automáticamente al hacer push a `main` si el proyecto Mintlify está conectado al repositorio `stevenrq/sgivu-frontend` con content directory `docs/`.

## Relación con Compodoc

Este sitio Mintlify documenta la **arquitectura, patrones y guías** del frontend.

[Compodoc](https://compodoc.app/) documenta la **referencia técnica de clases y APIs**. Para levantarlo:

```bash
# Desde la raíz del repo sgivu-frontend
npm run docs:serve
```

Disponible en `http://localhost:8080`. La salida se genera en `compodoc/` (en la raíz del repo, fuera de `docs/`) y está gitignoreada.

> **Importante:** la salida de Compodoc vive **fuera** de `docs/` a propósito. Sus web components (`compodoc-menu`) entran en conflicto con el runtime de Mintlify si se generan dentro de la raíz de contenido (`docs/`), rompiendo el preview local.

## Solución de Problemas

- Si `mint dev` no levanta: `mint update` para actualizar la CLI
- Si hay páginas 404: verificar que la página esté registrada en `docs.json` bajo `navigation`
- Si hay enlaces rotos: `mint broken-links` lista todos los enlaces inválidos
