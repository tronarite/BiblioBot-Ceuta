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
};
