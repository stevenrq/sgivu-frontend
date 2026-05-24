// Plantilla para producción / despliegue.
// Copia este archivo a `environment.ts` y actualiza según el entorno.
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com',
  // URL del auth server accesible desde el navegador para el probe de salud directo.
  authHealthCheckUrl: 'https://auth.example.com',
  clientId: 'angular-client',
};
