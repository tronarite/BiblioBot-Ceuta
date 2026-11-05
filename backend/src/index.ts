import "dotenv/config";
// Express 4 no captura los errores de las rutas async: sin esto, cualquier excepción (un
// email duplicado, una fecha inválida, un fallo puntual de la BD) acababa en una promesa
// rechazada sin capturar y Node cerraba el proceso entero (y con él el motor de reservas).
import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { env } from "./env";
import { authRouter } from "./auth/auth.routes";
import { selfRouter } from "./users/self.routes";
import { patronbaseAccountRouter } from "./patronbaseAccount/account.routes";
import { activityRouter } from "./activity/activity.routes";
import { librariesRouter } from "./libraries/libraries.routes";
import { reservationsRouter } from "./reservations/reservations.routes";
import { schedulesRouter } from "./schedules/schedules.routes";
import { friendsRouter } from "./friends/friends.routes";
import { adminRouter } from "./admin/admin.routes";
import { startScheduleEngine } from "./schedules/engine";
import { startScraperMonitor } from "./monitor/scraper-monitor";
import { precalentarCache } from "./libraries/libraries.service";

const app = express();
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/account/me", selfRouter);
app.use("/api/account/patronbase", patronbaseAccountRouter);
app.use("/api/account/activity", activityRouter);
app.use("/api/libraries", librariesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/admin", adminRouter);

// Último recurso para cualquier error de una ruta: responde sin tumbar el proceso y sin
// filtrar detalles internos al cliente.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ese dato ya está en uso" });
    if (err.code === "P2025") return res.status(404).json({ error: "No encontrado" });
  }
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "JSON no válido" });
  console.error(`Error en ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Error interno del servidor" });
});

// Red de seguridad para promesas fuera de las rutas (cron, precarga de caché…): se
// registra el error en vez de cerrar el proceso.
process.on("unhandledRejection", (reason) => console.error("Promesa rechazada sin capturar:", reason));

app.listen(env.port, () => {
  console.log(`BiblioBot backend escuchando en el puerto ${env.port}`);
  startScheduleEngine();
  startScraperMonitor();
  precalentarCache();
});
