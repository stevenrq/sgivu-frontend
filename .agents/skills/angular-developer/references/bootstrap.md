# Using Bootstrap 5 with Angular

Bootstrap 5 is the CSS framework used in this project. It is loaded via CDN in `src/index.html` — no npm import or build-step configuration is required.

## Project Setup

Bootstrap is included in `src/index.html` via CDN links:

```html
<!-- In <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

<!-- Before </body> -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.min.js"></script>
```

Global CSS overrides and Bootstrap CSS variable customizations live in `src/styles.css`.

## Bootstrap CSS Variables

Bootstrap 5 exposes its design tokens as CSS variables (`--bs-*`). This project overrides them in `src/styles.css` to theme the app:

```css
:root {
  --bs-body-bg: var(--bg-page);
  --bs-body-color: var(--text);
  --bs-border-color: var(--border);
  --bs-primary: var(--accent);
  --bs-primary-rgb: var(--accent-rgb);
}
```

Use `--bs-*` variables when you need to align custom components with Bootstrap's theming system.

## Grid System

Bootstrap uses a 12-column, mobile-first flexbox grid. The six breakpoints are:

| Breakpoint | Min width | Class prefix |
|------------|-----------|--------------|
| xs         | —         | `.col-`      |
| sm         | 576px     | `.col-sm-`   |
| md         | 768px     | `.col-md-`   |
| lg         | 992px     | `.col-lg-`   |
| xl         | 1200px    | `.col-xl-`   |
| xxl        | 1400px    | `.col-xxl-`  |

```html
<div class="container">
  <div class="row">
    <div class="col-12 col-md-8">Main content</div>
    <div class="col-12 col-md-4">Sidebar</div>
  </div>
</div>
```

Use `.row-cols-{n}` to set a uniform number of columns per row:

```html
<div class="row row-cols-1 row-cols-md-3 g-3">
  <div class="col">...</div>
  <div class="col">...</div>
</div>
```

## Spacing Utilities

Spacing classes follow the pattern `{property}{sides}-{size}` (or `{property}{sides}-{breakpoint}-{size}`):

- **Property**: `m` (margin), `p` (padding)
- **Sides**: `t` top · `b` bottom · `s` start · `e` end · `x` horizontal · `y` vertical · (blank) all
- **Size**: `0`–`5` (0 = 0, 1 = 0.25rem, 2 = 0.5rem, 3 = 1rem, 4 = 1.5rem, 5 = 3rem) · `auto`

```html
<div class="mt-3 px-2 mb-md-4">...</div>
```

## Flexbox Utilities

```html
<div class="d-flex justify-content-between align-items-center gap-2">
  <span>Label</span>
  <button class="btn btn-primary">Action</button>
</div>
```

Key classes: `d-flex` · `d-inline-flex` · `flex-column` · `justify-content-{start|end|center|between|around|evenly}` · `align-items-{start|end|center|baseline|stretch}` · `flex-wrap` · `flex-grow-1` · `gap-{0–5}` · `ms-auto` / `me-auto`.

All flex utilities support responsive prefixes: `.d-md-flex`, `.justify-content-lg-between`, etc.

## Display Utilities

```html
<div class="d-none d-md-block">Visible only from md up</div>
<div class="d-block d-md-none">Visible only below md</div>
```

## Components in Angular Templates

Bootstrap 5 components work through CSS classes and `data-bs-*` attributes — no jQuery required. Angular handles events natively.

### Buttons

```html
<button type="button" class="btn btn-primary">Save</button>
<button type="button" class="btn btn-outline-secondary">Cancel</button>
<button type="button" class="btn btn-sm btn-danger">Delete</button>
```

### Modals (data attributes)

```html
<!-- Trigger -->
<button type="button" class="btn btn-primary"
        data-bs-toggle="modal" data-bs-target="#confirmModal">
  Open
</button>

<!-- Modal -->
<div class="modal fade" id="confirmModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Confirm</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">Are you sure?</div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" (click)="confirm()">Confirm</button>
      </div>
    </div>
  </div>
</div>
```

For programmatic control in Angular, use the Bootstrap JS API:

```typescript
import { Modal } from 'bootstrap';

const modal = new Modal(document.getElementById('confirmModal')!);
modal.show();
modal.hide();
```

### Alerts

```html
<div class="alert alert-success alert-dismissible fade show" role="alert">
  Operation successful.
  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
```

### Badges

```html
<span class="badge bg-success">Active</span>
<span class="badge bg-danger">Error</span>
<span class="badge bg-warning text-dark">Pending</span>
```

### Cards

```html
<div class="card">
  <div class="card-header">Title</div>
  <div class="card-body">
    <p class="card-text">Content</p>
  </div>
  <div class="card-footer">Footer</div>
</div>
```

## Bootstrap Icons

Icons are available as an icon font via CDN. Use the `bi bi-{icon-name}` class pattern on an `<i>` element:

```html
<i class="bi bi-check-circle-fill text-success"></i>
<i class="bi bi-exclamation-triangle text-warning"></i>
<i class="bi bi-trash fs-5"></i>
```

Browse all 2,000+ icons at [icons.getbootstrap.com](https://icons.getbootstrap.com). Size with `fs-{1–6}` or a custom `font-size`. Color with text utilities (`text-primary`, `text-danger`, etc.) or CSS variables.

## Text & Color Utilities

```html
<p class="text-muted">Secondary text</p>
<p class="text-primary fw-bold">Emphasized</p>
<span class="text-danger">Error message</span>
<div class="bg-light p-3 rounded">Light surface</div>
```

## Angular-Specific Notes

- Use Angular `(click)` / `(change)` bindings for interactivity instead of Bootstrap JS event listeners.
- Use `[class.active]="condition"` or `[ngClass]` to toggle Bootstrap state classes dynamically.
- For interactive components (dropdowns inside `ChangeDetectionStrategy.OnPush`, modals triggered from services), prefer `@ng-bootstrap/ng-bootstrap` which provides native Angular directives.

```bash
ng add @ng-bootstrap/ng-bootstrap
```

- Global Bootstrap component styles (`.card`, `.btn`, `.table`, etc.) are overridden in `src/styles.css` using CSS variables — do not duplicate those overrides in component-level stylesheets.
