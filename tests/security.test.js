// Unit tests 1-8 (generated with an LLM, reviewed and corrected by hand).
// Focus: authentication, access control, injection and output encoding.

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const { get, all, waitFor, register, login, registerAndLogin, closeDb } = require('./helpers');

beforeAll(async () => {
    // database.js creates the tables when it is required; wait until they exist
    await waitFor(() => get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"));
});

afterAll(async () => {
    await closeDb();
});

// 1. Passwords must never be stored in readable form.
test('registration stores a bcrypt hash instead of the plaintext password', async () => {
    const user = await register(app, 'alice', 'Sup3r-Secret!');

    expect(user).toBeTruthy();
    expect(user.password).not.toBe('Sup3r-Secret!');
    expect(user.password).toMatch(/^\$2[aby]\$/);          // bcrypt hash format
    expect(bcrypt.compareSync('Sup3r-Secret!', user.password)).toBe(true);
});

// 2. An attacker must not be able to overwrite an existing account by
//    registering the same username again.
test('registering an existing username does not create a second account', async () => {
    await register(app, 'bob', 'first-password');
    await request(app).post('/auth/register').type('form')
        .send({ username: 'bob', password: 'second-password' });

    const rows = await all('SELECT * FROM users WHERE username = ?', ['bob']);
    expect(rows).toHaveLength(1);
    expect(bcrypt.compareSync('first-password', rows[0].password)).toBe(true);
});

// 3. A successful login must return a session cookie that JavaScript cannot read.
test('valid login returns an httpOnly session cookie', async () => {
    await register(app, 'carol', 'carol-password');

    const res = await request(app).post('/auth/login').type('form')
        .send({ username: 'carol', password: 'carol-password' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const cookies = (res.headers['set-cookie'] || []).join('; ');
    expect(cookies).toMatch(/sessionId=/);
    expect(cookies.toLowerCase()).toContain('httponly');
});

// 4. A wrong password must not authenticate the user.
test('login with a wrong password is rejected and sets no session cookie', async () => {
    await register(app, 'dave', 'correct-password');

    const res = await request(app).post('/auth/login').type('form')
        .send({ username: 'dave', password: 'wrong-password' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Invalid username or password');
    expect(res.headers['set-cookie']).toBeUndefined();
});

// 5. The login query must be parameterised, so SQL in the username is only data.
test('SQL injection in the username does not authenticate or damage the database', async () => {
    await register(app, 'erin', 'erin-password');

    const bypass = await request(app).post('/auth/login').type('form')
        .send({ username: "erin' OR '1'='1", password: 'anything' });

    expect(bypass.status).toBe(200);
    expect(bypass.headers['set-cookie']).toBeUndefined();

    await request(app).post('/auth/login').type('form')
        .send({ username: "x'; DROP TABLE users; --", password: 'anything' });

    const table = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    expect(table).toBeTruthy();
    const stillThere = await get('SELECT * FROM users WHERE username = ?', ['erin']);
    expect(stillThere).toBeTruthy();
});

// 6. The blog content must not be readable without logging in.
test('the front page redirects anonymous visitors to the login page', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
});

// 7. The admin page must be available to the admin account.
test('the admin page is shown to the admin user', async () => {
    const cookie = await registerAndLogin(app, 'admin', 'admin-password');

    const res = await request(app).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Admin Page');
});

// 8. Post content must be HTML-escaped so that stored XSS is not possible.
test('a script tag in a post is escaped on the front page', async () => {
    const cookie = await registerAndLogin(app, 'frank', 'frank-password');
    const payload = '<script>alert("xss")</script>';

    await request(app).post('/new-post').set('Cookie', cookie).type('form')
        .send({ title: 'XSS attempt', content: payload });

    const res = await request(app).get('/').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain('XSS attempt');
    expect(res.text).not.toContain(payload);          // not rendered as raw HTML
    expect(res.text).toContain('&lt;script&gt;');     // rendered as escaped text
});
