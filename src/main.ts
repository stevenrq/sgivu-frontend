import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Módulos JS de Bootstrap empaquetados desde npm (sin CDN). Solo se registran
// los realmente usados: dropdown (menús de acciones en listados y navbar) y
// tab (pestañas de settings/configuration). Collapse lo importa el navbar.
// Si se usa otro componente con data-bs-* (modal, tooltip…), debe importarse aquí.
import 'bootstrap/js/dist/dropdown';
import 'bootstrap/js/dist/tab';

registerLocaleData(localeEsCO);

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
