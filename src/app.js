const express = require("express");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const { swaggerSpec, swaggerUi } = require("./config/swagger");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-razorpay-signature");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl === "/api/payments/webhook") {
        req.rawBody = Buffer.from(buf);
      }
    },
  }),
);

if (process.env.APP_ENV !== "prod") {
  app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
