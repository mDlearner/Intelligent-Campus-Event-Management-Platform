const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const pinoHttp = require("pino-http");
const { randomUUID } = require("crypto");

const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const notificationRoutes = require("./routes/notifications");
const sanitizeInput = require("./middleware/sanitizeInput");
const logger = require("./utils/logger");

function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(express.json());
  app.use(mongoSanitize());
  app.use(sanitizeInput);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const headerValue = req.headers["x-request-id"];
        const incomingId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const requestId = incomingId?.trim() || randomUUID();
        res.setHeader("x-request-id", requestId);
        return requestId;
      },
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) {
          return "error";
        }
        if (res.statusCode >= 400) {
          return "warn";
        }
        return "info";
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} completed`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} failed${err?.message ? `: ${err.message}` : ""}`,
      serializers: {
        req(request) {
          return {
            id: request.id,
            method: request.method,
            url: request.url,
            remoteAddress: request.remoteAddress,
            remotePort: request.remotePort
          };
        },
        res(response) {
          return {
            statusCode: response.statusCode
          };
        }
      }
    })
  );

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || "Server error";
    req.log.error(
      {
        err,
        requestId: req.id,
        status,
        path: req.originalUrl
      },
      "Unhandled request error"
    );
    res.status(status).json({ message, requestId: req.id });
  });

  return app;
}

module.exports = { createApp };