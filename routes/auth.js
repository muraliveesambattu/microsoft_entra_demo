/**
 * routes/auth.js — Authentication routes
 *
 * Handles:
 *   GET  /login                         → render login page
 *   POST /auth/local/login              → email + password login
 *   POST /auth/local/register           → create a new local account
 *   GET  /auth/microsoft                → start Microsoft OAuth flow
 *   POST /auth/microsoft/email          → handle email submission for Microsoft login
 *   POST /auth/microsoft/start          → start Microsoft login after SSO check
 *   GET  /auth/microsoft/callback       → handle Microsoft redirect
 *   GET  /logout                        → destroy session
 */

const express = require("express");
const msal = require("@azure/msal-node");
const { msalConfig, REDIRECT_URI_OIDC, SCOPES } = require("../config");
const userStore = require("../store/users");

const router = express.Router();

let msalClient = null;

function getMsalClient() {
  if (!msalClient) {
    if (!msalConfig.auth.clientId || !msalConfig.auth.clientSecret) {
      throw new Error(
        "Microsoft Entra environment variables (CLIENT_ID, CLIENT_SECRET, TENANT_ID) are not configured."
      );
    }
    msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

// Helper: Simulate SSO config fetch
async function getSsoConfigForEmail(email) {
  // Replace this with real DB/API lookup
  if (
    email.toLowerCase().includes('microsoft') ||
    email.toLowerCase() === 'murali.v@labtech24.in'
  ) {
    return { provider: 'microsoft', tenant: 'example-tenant' };
  }
  return null;
}

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

// Step 1: Show email entry page before redirecting to Microsoft
router.get("/auth/microsoft", (req, res) => {
  res.render("microsoft_email", { error: null, showMicrosoftButton: false, email: "" });
});

// Step 2: Handle email submission, check SSO config, then show Microsoft button if SSO enabled
router.post("/auth/microsoft/email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.render("microsoft_email", { error: "Email is required.", showMicrosoftButton: false, email: "" });
  }
  // Simulate SSO config fetch (replace with real logic as needed)
  // For demo: if email contains 'microsoft', assume SSO enabled
  const ssoConfig = await getSsoConfigForEmail(email);
  const isSsoEnabled = ssoConfig && ssoConfig.provider === 'microsoft';
  if (!isSsoEnabled) {
    return res.render("microsoft_email", { error: "No Microsoft SSO configuration found for this email.", showMicrosoftButton: false, email });
  }
  // SSO enabled: show Microsoft login button
  res.render("microsoft_email", { error: null, showMicrosoftButton: true, email });
});

// Step 3: Microsoft login redirect (after email is validated)
router.post("/auth/microsoft/start", async (req, res) => {
  const { email } = req.body;
  try {
    const authUrl = await getMsalClient().getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: REDIRECT_URI_OIDC,
      loginHint: email,
      prompt: "select_account",
    });
    res.redirect(authUrl);
  } catch (err) {
    console.error("Microsoft auth start error:", err.message, err.stack);
    const detail = process.env.NODE_ENV !== "production" ? ` (${err.message})` : "";
    res.render("microsoft_email", { error: `Could not start Microsoft login. Check your Entra config.${detail}`, showMicrosoftButton: true, email });
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
    const tokenResponse = await getMsalClient().acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI_OIDC,
    });

    // Log the full response from Microsoft Entra
    if (process.env.NODE_ENV !== "production") {
      console.log("[Microsoft Entra] Token Response:", JSON.stringify(tokenResponse, null, 2));
    } else {
      console.info("[Microsoft Entra] Token Response received (details hidden in production)");
    }

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
// ─── SAML Assertion Consumer Service (ACS) endpoint — for SAML responses ───
router.post("/auth/saml/callback", async (req, res) => {
  try {
    // Log all body parameters received from the SAML IdP
    console.log("[SAML CALLBACK] Body Params:", req.body);
    const { SAMLResponse, RelayState, error, error_description, email } = req.body;

    // Log and handle error responses from SAML IdP
    if (error) {
      console.error("[SAML CALLBACK] Error from IdP:", error, error_description);
      return res.render("login", { error: `SAML login failed: ${error_description || error}` });
    }

    if (!SAMLResponse) {
      console.error("[SAML CALLBACK] No SAMLResponse received.");
      return res.render("login", { error: "SAML login failed — no SAMLResponse received." });
    }

    // Simulate extracting user info from SAML assertion (replace with real parsing in production)
    // For demo, use a static user or email from RelayState/body
    const userEmail = email || "samluser@example.com";
    const userName = "SAML User";
    console.log("[SAML CALLBACK] Using userEmail:", userEmail);

    // Create a local record if this is the user's first SAML login
    const user = userStore.findOrCreateMicrosoftUser(userEmail, userName);

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: "saml",
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("[SAML CALLBACK] Unhandled error:", err);
    res.render("login", {
      error: "SAML login failed. Please try again. (See server logs for details)",
    });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.redirect("/login");
  });
});



module.exports = router;