/**
 * config.js — MSAL (Microsoft Authentication Library) configuration
 *
 * Reads Azure / Entra ID credentials from environment variables and
 * exports the objects that @azure/msal-node needs.
 */

require("dotenv").config();

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(logLevel, message) {
        if (process.env.NODE_ENV === "development") {
          console.log("[MSAL]", message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Error
    },
  },
};

// Scopes requested during the Microsoft login flow
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPES = ["openid", "profile", "email", "User.Read"];

module.exports = { msalConfig, REDIRECT_URI, SCOPES };
