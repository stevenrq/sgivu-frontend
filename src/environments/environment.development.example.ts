// Plantilla para desarrollo local.
// Copia este archivo a `environment.development.ts` y reemplaza los valores.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  // URL del auth server accesible desde el navegador para el probe de salud directo.
  // El hostname nip.io resuelve a 127.0.0.1 vía DNS público (sin editar hosts) y debe coincidir
  // con el issuer. No usar el hostname interno del contenedor ('sgivu-auth:9000').
  authHealthCheckUrl: 'http://sgivu-auth.127.0.0.1.nip.io:9000',
  clientId: 'angular-local',
};
