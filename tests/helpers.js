// Shared helpers for the unit tests: promise wrappers for the SQLite calls,
// a small polling helper and a login helper.

const request = require('supertest');
const db = require('../database');

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err); else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });
}

// The /auth/register route answers before the INSERT has finished, so a test
// that reads the row immediately can miss it. This polls until the value is
// there or the timeout is reached.
async function waitFor(fn, timeoutMs = 3000, intervalMs = 25) {
    const deadline = Date.now() + timeoutMs;
    let result = await fn();
    while (!result && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        result = await fn();
    }
    return result;
}

// Registers a user through the application and waits until it is in the database.
async function register(app, username, password) {
    await request(app).post('/auth/register').type('form').send({ username, password });
    return waitFor(() => get('SELECT * FROM users WHERE username = ?', [username]));
}

// Logs in and returns the session cookie that the application set.
async function login(app, username, password) {
    const res = await request(app).post('/auth/login').type('form').send({ username, password });
    return res.headers['set-cookie'];
}

// Registers a user and returns a ready-to-use session cookie.
async function registerAndLogin(app, username, password) {
    await register(app, username, password);
    return login(app, username, password);
}

function closeDb() {
    return new Promise((resolve) => db.close(() => resolve()));
}

module.exports = { db, run, get, all, waitFor, register, login, registerAndLogin, closeDb };
