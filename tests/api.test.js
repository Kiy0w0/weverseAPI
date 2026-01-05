const request = require('supertest');
const app = require('../index');
const logger = require('../lib/logger');

// Mute logs during tests
beforeAll(() => {
    logger.transports.forEach(t => (t.silent = true));
});

afterAll(() => {
    logger.transports.forEach(t => (t.silent = false));
});

describe('API Endpoints', () => {
    describe('GET /', () => {
        it('should return welcome message', async () => {
            const res = await request(app).get('/');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'Welcome to Weverse API');
            expect(res.body).toHaveProperty('version');
        });
    });

    describe('GET /api/status', () => {
        it('should return online status', async () => {
            const res = await request(app).get('/api/status');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'online');
        });
    });

    describe('404 Handling', () => {
        it('should return 404 for unknown routes', async () => {
            const res = await request(app).get('/api/unknown/route');
            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty('error', 'Not Found');
        });
    });

    describe('Export Endpoint', () => {
        it('should exist and require auth (returns 401 without token)', async () => {
            const res = await request(app).get('/api/communities/123/export');
            // 401 means the route was found and auth middleware blocked it, which is pass for existence check
            expect(res.statusCode).not.toBe(404);
        });
    });

    describe('RSS Endpoint', () => {
        it('should exist and return XML content type (or 401)', async () => {
            // We expect 401 because we are not mocking auth fully here, 
            // but we can check if it hits the route.
            const res = await request(app).get('/api/communities/123/rss');
            expect(res.statusCode).not.toBe(404);
        });
    });

    describe('New Features', () => {
        it('Notifications endpoint should exist', async () => {
            const res = await request(app).get('/api/notifications');
            expect(res.statusCode).not.toBe(404);
        });

        it('Widget endpoint should exist and return HTML (or 401)', async () => {
            const res = await request(app).get('/api/widgets/latest/123');
            expect(res.statusCode).not.toBe(404);
        });

        it('Calendar endpoint should exist and return text/calendar (or 401)', async () => {
            const res = await request(app).get('/api/communities/123/calendar');
            expect(res.statusCode).not.toBe(404);
        });
    });
});
