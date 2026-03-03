/**
 * middleware/authMiddleware.js — Route protection
 *
 * Attach this middleware to any route that should only be
 * accessible to logged-in users.
 */

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // Not logged in — bounce back to the login page
  res.redirect("/login");
}

module.exports = { ensureAuthenticated };
