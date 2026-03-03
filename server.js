/**
 * server.js — Application entry point
 *
 * Sets up Express, sessions, view engine, and mounts routes.
 */

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/auth");
const { ensureAuthenticated } = require("./middleware/authMiddleware");
const userStore = require("./store/users");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── View engine ─────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Session configuration ───────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

// Auth routes (login, register, Microsoft OAuth, logout)
app.use("/", authRoutes);

// Home page → redirect to login
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Protected dashboard
app.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.render("dashboard", { user: req.session.user });
});

// ─── Start server (local dev only; Vercel uses the export below) ────────────

if (require.main === module) {
  (async () => {
    await userStore.seedDemoUser();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })();
}

module.exports = app;
