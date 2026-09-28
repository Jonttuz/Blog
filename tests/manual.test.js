//
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
//tes 9.
test('the admin page is denied to anonymous visitors', async () => {
    const res = await request(app).get('/admin');

    expect(res.status).toBe(403);
    expect(res.text).toContain('Access denied');
});
//test 10.
test('the admin page is denied to a normal logged-in user', async () => {
        const cookie = await registerAndLogin(app, 'grace', 'grace-password');

        const res = await request(app).get('/admin').set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access denied');
        expect(res.text).not.toContain('Admin Page');   
});
