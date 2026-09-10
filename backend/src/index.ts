import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./env";
import { authRouter } from "./auth/auth.routes";
import { selfRouter } from "./users/self.routes";
import { patronbaseAccountRouter } from "./patronbaseAccount/account.routes";
import { activityRouter } from "./activity/activity.routes";
import { librariesRouter } from "./libraries/libraries.routes";
import { reservationsRouter } from "./reservations/reservations.routes";
import { schedulesRouter } from "./schedules/schedules.routes";
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
app.use("/api/admin", adminRouter);

app.listen(env.port, () => {
  console.log(`BiblioBot backend escuchando en el puerto ${env.port}`);
  startScheduleEngine();
  startScraperMonitor();
  precalentarCache();
});
