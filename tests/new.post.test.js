// Unit test 11, added after testing the pipeline with deliberate security defects.
// None of the first ten tests sends an unauthenticated POST to /new-post, so a
// missing authentication check on that route went unnoticed. This test closes the gap.

const request = require('supertest');
const app = require('../app');
const { get, all, waitFor, registerAndLogin, closeDb } = require('./helpers');

beforeAll(async () => {
    await waitFor(() => get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"));
});

afterAll(async () => {
    await closeDb();
});

// 11. Creating a post must require a session.
test('anonymous visitors cannot create posts', async () => {
    const before = await all('SELECT * FROM posts');

    const res = await request(app).post('/new-post').type('form')
        .send({ title: 'Posted without login', content: 'anyone can write here' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');

    const after = await all('SELECT * FROM posts');
    expect(after).toHaveLength(before.length);
});

// 12. The same route must still work for a logged-in user, so that test 11 cannot be
//     satisfied by simply breaking post creation for everyone.
test('logged-in users can still create posts', async () => {
    const cookie = await registerAndLogin(app, 'heidi', 'heidi-password');

    const res = await request(app).post('/new-post').set('Cookie', cookie).type('form')
        .send({ title: 'Posted while logged in', content: 'this one is allowed' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const post = await waitFor(() => get('SELECT * FROM posts WHERE title = ?', ['Posted while logged in']));
    expect(post).toBeTruthy();
});
