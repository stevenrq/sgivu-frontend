// Plantilla para desarrollo local.
// Copia este archivo a `environment.development.ts` y reemplaza los valores.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  // URL del auth server accesible desde el navegador para el probe de salud directo.
  // Usa el puerto expuesto por Docker, no el hostname interno del contenedor.
  authHealthCheckUrl: 'http://localhost:9000',
  clientId: 'angular-local',
};
