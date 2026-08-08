function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  credentialsEncKey: required("CREDENTIALS_ENC_KEY"),
  databaseUrl: required("DATABASE_URL"),
  patronbaseBaseUrl: process.env.PATRONBASE_BASE_URL ?? "https://es.patronbase.com/_BibliotecaCeuta",
  scheduleRetryDelayMinutes: Number(process.env.SCHEDULE_RETRY_DELAY_MINUTES ?? 1),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  // Independiente de NODE_ENV: este despliegue no tiene terminación HTTPS delante
  // (docker-compose sirve todo por HTTP plano, incluido el acceso por IP de LAN desde
  // móviles). Una cookie "Secure" solo se envía por HTTPS, salvo la excepción de
  // "localhost" que los navegadores tratan como origen seguro aunque sea HTTP — por eso
  // el login parecía funcionar en el propio PC pero la sesión nunca persistía al entrar
  // por la IP de red. Se activa explícitamente vía COOKIE_SECURE si algún día se pone
  // HTTPS delante.
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
