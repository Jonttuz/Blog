// Unit tests 9-10 - WRITE THESE TWO YOURSELF.
//
// The assignment asks which tests were written manually and which were
// generated, so these two are left as skeletons on purpose. Both check access
// control on the /admin page. Use tests/security.test.js as an example:
//   - request(app).get('/admin')                      -> anonymous request
//   - request(app).get('/admin').set('Cookie', cookie) -> request as a user
//   - registerAndLogin(app, username, password)        -> returns the cookie
//
// The application answers a denied request with status 403 and the text
// 'Access denied'.

const request = require('supertest');
const app = require('../app');
const { waitFor, get, registerAndLogin, closeDb } = require('./helpers');

beforeAll(async () => {
    await waitFor(() => get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"));
});

afterAll(async () => {
    await closeDb();
});

// 9. An anonymous visitor must not reach the admin page.
test('the admin page is denied to anonymous visitors', async () => {
    // TODO: request /admin without a cookie
    // TODO: expect status 403 and the text 'Access denied'
});

// 10. A normal logged-in user must not reach the admin page either.
test('the admin page is denied to a normal logged-in user', async () => {
    // TODO: register and log in as a normal user, for example 'grace'
    // TODO: request /admin with that cookie
    // TODO: expect status 403 and the text 'Access denied'
});
