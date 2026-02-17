import express from "express";
import cors from "cors";
import compression from "compression";
import { createServer } from "http";
import { env } from "./lib/env.js";
import { initializeWebSocket } from "./realtime/websocket.js";
import { startAnalysisWorker } from "./jobs/analysis-worker.js";

// Route imports
import authRouter from "./routes/auth.js";
import clubsRouter from "./routes/clubs.js";
import teamsRouter from "./routes/teams.js";
import gamesRouter from "./routes/games.js";
import calendarRouter from "./routes/calendar.js";
import streamingRouter from "./routes/streaming.js";
import analysisRouter from "./routes/analysis.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import playersRouter from "./routes/players.js";
import standingsRouter from "./routes/standings.js";

// ── Express App ─────────────────────────────────────────────

const app = express();
const server = createServer(app);

// ── Middleware ───────────────────────────────────────────────

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(compression());

// Raw body for Stripe webhooks (must be registered before the JSON body parser)
app.use(
  "/api/subscriptions/webhook",
  express.raw({ type: "application/json" })
);

// JSON and URL-encoded body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging (skip health checks to reduce noise)
app.use((req, _res, next) => {
  if (req.path !== "/health") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Initialize WebSocket ────────────────────────────────────

initializeWebSocket(server);

// ── Mount Route Modules ─────────────────────────────────────
// Note: Each router defines its full path (e.g., "/api/auth/me"),
// so they are all mounted at the root level.

app.use(authRouter);          // /api/auth/*
app.use(clubsRouter);         // /api/clubs/*
app.use(teamsRouter);         // /api/teams/* and /api/clubs/:clubId/teams
app.use(gamesRouter);         // /api/games/*
app.use(calendarRouter);      // /api/calendar/*
app.use(streamingRouter);     // /api/streams/*
app.use(analysisRouter);      // /api/analysis/* and /api/upload/*
app.use(subscriptionsRouter); // /api/subscriptions/*
app.use(playersRouter);       // /api/players/*
app.use(standingsRouter);     // /api/standings/*

// ── Health Check ────────────────────────────────────────────

const bootTime = Date.now();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.round((Date.now() - bootTime) / 1000),
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ── 404 Handler ─────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist.",
    },
  });
});

// ── Global Error Handler ────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          env.NODE_ENV === "production"
            ? "Internal server error."
            : err.message,
      },
    });
  }
);

// ── Start Analysis Worker ───────────────────────────────────

try {
  startAnalysisWorker();
} catch (err) {
  console.warn(
    "[Server] Analysis worker could not start (Redis may not be connected):",
    (err as Error).message
  );
}

// ── Listen ──────────────────────────────────────────────────

const PORT = env.API_PORT;

server.listen(PORT, () => {
  console.log(
    `\n  VolleyCoach API listening on port ${PORT} [${env.NODE_ENV}]\n`
  );
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  API base:     http://localhost:${PORT}/api\n`);
});

// ── Graceful Shutdown ───────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n[Server] ${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("[Server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
