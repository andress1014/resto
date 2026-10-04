"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const nock_1 = __importDefault(require("nock"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const socket_io_client_1 = require("socket.io-client");
const app_1 = require("../src/app");
const TEST_SECRET = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = TEST_SECRET;
process.env.IDENTITY_SERVICE_URL = 'http://localhost:4001';
process.env.CATALOG_SERVICE_URL = 'http://localhost:4002';
process.env.SESSION_SERVICE_URL = 'http://localhost:4003';
process.env.ORDERING_SERVICE_URL = 'http://localhost:4004';
describe('B. @services/gateway — API Gateway (Tests 15-27)', () => {
    let app;
    beforeEach(() => {
        nock_1.default.cleanAll();
        app = (0, app_1.createApp)();
    });
    afterEach(() => {
        nock_1.default.cleanAll();
    });
    describe('Health y enrutado (Tests 15-19)', () => {
        test('15. GET /health -> 200 con { status: "ok" } y entradas por servicio', async () => {
            const res = await (0, supertest_1.default)(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('services');
            expect(res.body.services).toHaveProperty('gateway', 'ok');
        });
        test('16. POST /v1/auth/login -> proxy a identity:4001/auth/login, conservando body y propagando status/body del upstream', async () => {
            const upstream = (0, nock_1.default)('http://localhost:4001')
                .post('/auth/login', { email: 'admin@resto.com', password: 'password123' })
                .reply(200, { token: 'jwt-token-xyz' });
            const res = await (0, supertest_1.default)(app)
                .post('/v1/auth/login')
                .send({ email: 'admin@resto.com', password: 'password123' });
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ token: 'jwt-token-xyz' });
        });
        test('17. POST /v1/graphql -> proxy a catalog:4002/graphql', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'admin' }, TEST_SECRET);
            const upstream = (0, nock_1.default)('http://localhost:4002')
                .post('/graphql', { query: '{ menu { id } }' })
                .reply(200, { data: { menu: [] } });
            const res = await (0, supertest_1.default)(app)
                .post('/v1/graphql')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: '{ menu { id } }' });
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ data: { menu: [] } });
        });
        test('18. GET /v1/sessions/abc -> proxy a session:4003/sessions/abc', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
            const upstream = (0, nock_1.default)('http://localhost:4003')
                .get('/sessions/abc')
                .reply(200, { id: 'abc', tableId: '10' });
            const res = await (0, supertest_1.default)(app)
                .get('/v1/sessions/abc')
                .set('Authorization', `Bearer ${token}`);
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id: 'abc', tableId: '10' });
        });
        test('19. POST /v1/orders -> proxy a ordering:4004/orders', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
            const upstream = (0, nock_1.default)('http://localhost:4004')
                .post('/orders', { items: ['item-1'] })
                .reply(201, { orderId: 'ord-123' });
            const res = await (0, supertest_1.default)(app)
                .post('/v1/orders')
                .set('Authorization', `Bearer ${token}`)
                .send({ items: ['item-1'] });
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(201);
            expect(res.body).toEqual({ orderId: 'ord-123' });
        });
    });
    describe('Auth (Tests 20-24)', () => {
        test('20. Ruta protegida sin cabecera Authorization -> 401 { error.code: "UNAUTHORIZED" }', async () => {
            const res = await (0, supertest_1.default)(app).get('/v1/sessions/123');
            expect(res.status).toBe(401);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
        test('21. Ruta protegida con JWT inválido o expirado -> 401', async () => {
            const invalidToken = 'not.a.valid.jwt';
            const res = await (0, supertest_1.default)(app)
                .get('/v1/sessions/123')
                .set('Authorization', `Bearer ${invalidToken}`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
        test('22. Ruta protegida con JWT válido -> el upstream recibe x-user-id y x-tenant-id correctos', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'user-77', tenantId: 'tenant-99', role: 'customer' }, TEST_SECRET);
            const upstream = (0, nock_1.default)('http://localhost:4003', {
                reqheaders: {
                    'x-user-id': 'user-77',
                    'x-tenant-id': 'tenant-99',
                },
            })
                .get('/sessions/123')
                .reply(200, { ok: true });
            const res = await (0, supertest_1.default)(app)
                .get('/v1/sessions/123')
                .set('Authorization', `Bearer ${token}`);
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(200);
        });
        test('23. PATCH /v1/orders/:id/status con JWT de rol customer -> 403', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
            const res = await (0, supertest_1.default)(app)
                .patch('/v1/orders/ord-1/status')
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'PREPARING' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('FORBIDDEN');
        });
        test('24. POST /v1/auth/login no exige token (ruta pública)', async () => {
            (0, nock_1.default)('http://localhost:4001')
                .post('/auth/login')
                .reply(200, { token: 'jwt' });
            const res = await (0, supertest_1.default)(app)
                .post('/v1/auth/login')
                .send({ email: 'test@resto.com', password: 'secret' });
            expect(res.status).not.toBe(401);
            expect(res.status).toBe(200);
        });
    });
    describe('Errores (Tests 25-26)', () => {
        test('25. Ruta desconocida /v1/nope -> 404 { error.code: "NOT_FOUND" }', async () => {
            const res = await (0, supertest_1.default)(app).get('/v1/nope');
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
        test('26. Upstream caído -> 502 { error.code: "UPSTREAM_UNAVAILABLE" }', async () => {
            const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
            (0, nock_1.default)('http://localhost:4003')
                .get('/sessions/crash')
                .replyWithError('Connection refused');
            const res = await (0, supertest_1.default)(app)
                .get('/v1/sessions/crash')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(502);
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
        });
    });
    describe('WebSocket (Test 27)', () => {
        test('27. socket.io-client conecta al namespace /orders a través del gateway contra un stub de ordering', (done) => {
            // Stub server for ordering WebSocket upstream
            const orderingHttpServer = http_1.default.createServer();
            const orderingIo = new socket_io_1.Server(orderingHttpServer);
            const ordersNamespace = orderingIo.of('/orders');
            ordersNamespace.on('connection', (socket) => {
                socket.emit('ready', { message: 'ordering-connected' });
            });
            orderingHttpServer.listen(0, () => {
                const orderingPort = orderingHttpServer.address().port;
                process.env.ORDERING_WS_PORT = String(orderingPort);
                // Gateway HTTP server with socket proxying
                const gatewayServer = http_1.default.createServer(app);
                gatewayServer.listen(0, () => {
                    const gatewayPort = gatewayServer.address().port;
                    const token = jsonwebtoken_1.default.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
                    const client = (0, socket_io_client_1.io)(`http://localhost:${gatewayPort}/orders`, {
                        auth: { token },
                        transports: ['websocket'],
                        reconnection: false,
                        timeout: 1000,
                    });
                    client.on('connect_error', (err) => {
                        client.close();
                        gatewayServer.close();
                        orderingHttpServer.close();
                        // In RED phase, gateway has no socket.io handler so connect will fail/timeout
                        expect(err).toBeDefined();
                        // We force failure here for Red phase
                        done(new Error(`WebSocket connection failed as expected in Red phase: ${err.message}`));
                    });
                    client.on('ready', (data) => {
                        expect(data.message).toBe('ordering-connected');
                        client.close();
                        gatewayServer.close();
                        orderingHttpServer.close();
                        done();
                    });
                });
            });
        }, 4000);
    });
});
//# sourceMappingURL=gateway.test.js.map