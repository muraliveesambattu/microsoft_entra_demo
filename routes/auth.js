/**
 * routes/auth.js — Authentication routes
 *
 * Handles:
 *   GET  /login                         → render login page
 *   POST /auth/local/login              → email + password login
 *   POST /auth/local/register           → create a new local account
 *   GET  /auth/microsoft                → start Microsoft OAuth flow
 *   GET  /auth/microsoft/callback       → handle Microsoft redirect
 *   GET  /logout                        → destroy session
 */

const express = require("express");
const msal = require("@azure/msal-node");
const { msalConfig, REDIRECT_URI, SCOPES } = require("../config");
const userStore = require("../store/users");

const router = express.Router();

// Create a single ConfidentialClientApplication instance
const msalClient = new msal.ConfidentialClientApplication(msalConfig);

// ─── Login page ──────────────────────────────────────────────────────────────

router.get("/login", (req, res) => {
  // If already logged in, go straight to the dashboard
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

// ─── Local login (email + password) ──────────────────────────────────────────

router.post("/auth/local/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "Email and password are required." });
    }

    const user = userStore.findByEmail(email);
    if (!user) {
      return res.render("login", { error: "No account found with that email." });
    }

    const valid = await userStore.verifyPassword(user, password);
    if (!valid) {
      return res.render("login", { error: "Incorrect password." });
    }

    // Store user info in the session (omit passwordHash)
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Local login error:", err);
    res.render("login", { error: "Something went wrong. Please try again." });
  }
});

// ─── Local registration ──────────────────────────────────────────────────────

router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("register", { error: null });
});

router.post("/auth/local/register", async (req, res) => {
  try {
    const { email, name, password, confirmPassword } = req.body;

    if (!email || !name || !password) {
      return res.render("register", { error: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.render("register", { error: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.render("register", { error: "Password must be at least 6 characters." });
    }

    if (userStore.findByEmail(email)) {
      return res.render("register", { error: "An account with that email already exists." });
    }

    const user = await userStore.createLocalUser(email, name, password);

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Registration error:", err);
    res.render("register", { error: "Something went wrong. Please try again." });
  }
});

// ─── Microsoft OAuth — Start ─────────────────────────────────────────────────

router.get("/auth/microsoft", async (req, res) => {
  try {
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      prompt: "select_account",
    });
    res.redirect(authUrl);
  } catch (err) {
    console.error("Microsoft auth start error:", err);
    res.render("login", { error: "Could not start Microsoft login. Check your Entra config." });
  }
});

// ─── Microsoft OAuth — Callback ──────────────────────────────────────────────

router.get("/auth/microsoft/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.render("login", { error: "Microsoft login failed — no authorization code received." });
    }

    // Exchange the authorization code for tokens
    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    });

    // Extract user info from the ID token claims
    const claims = tokenResponse.idTokenClaims;
    const email = claims.preferred_username || claims.email || claims.upn;
    const name = claims.name || email;

    // Create a local record if this is the user's first Microsoft login
    const user = userStore.findOrCreateMicrosoftUser(email, name);

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: "microsoft",
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Microsoft callback error:", err);
    res.render("login", {
      error: "Microsoft login failed. Please try again.",
    });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.redirect("/login");
  });
});

module.exports = router;
