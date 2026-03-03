/**
 * store/users.js — Simple in-memory user store
 *
 * In a real application you would replace this with a database.
 * Each user object looks like:
 *   { id, email, name, passwordHash, provider }
 *
 * `provider` is either "local" or "microsoft".
 */

const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

// In-memory array — resets every time the server restarts
const users = [];
let nextId = 1;

/**
 * Find a user by email (case-insensitive).
 */
function findByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/**
 * Find a user by their numeric id.
 */
function findById(id) {
  return users.find((u) => u.id === id);
}

/**
 * Create a new local user with a hashed password.
 * Returns the created user (without the raw password).
 */
async function createLocalUser(email, name, plainPassword) {
  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  const user = {
    id: nextId++,
    email,
    name,
    passwordHash,
    provider: "local",
  };
  users.push(user);
  return user;
}

/**
 * Create (or return existing) user from a Microsoft login.
 * If the email already exists we just return that record.
 */
function findOrCreateMicrosoftUser(email, name) {
  let user = findByEmail(email);
  if (user) return user;

  user = {
    id: nextId++,
    email,
    name,
    passwordHash: null, // Microsoft users don't have a local password
    provider: "microsoft",
  };
  users.push(user);
  return user;
}

/**
 * Verify a plaintext password against a user's stored hash.
 */
async function verifyPassword(user, plainPassword) {
  if (!user.passwordHash) return false;
  return bcrypt.compare(plainPassword, user.passwordHash);
}

/**
 * Seed a demo user so you can test local login immediately.
 */
async function seedDemoUser() {
  const existing = findByEmail("demo@example.com");
  if (!existing) {
    await createLocalUser("demo@example.com", "Demo User", "password123");
    console.log('Seeded demo user  →  email: demo@example.com  password: password123');
  }
}

module.exports = {
  findByEmail,
  findById,
  createLocalUser,
  findOrCreateMicrosoftUser,
  verifyPassword,
  seedDemoUser,
};
