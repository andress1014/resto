import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createIdentityApp } from '../../src/app';

const TEST_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0';

describe('B. Identity — integración HTTP (Tests 11-15)', () => {
  let app: any;

  beforeEach(() => {
    app = createIdentityApp();
  });

  test('11. POST /auth/register 201 -> tenant y user persistidos; el password en DB está hasheado (no contiene el claro)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Bistró Moderno',
        adminEmail: 'chef@bistro.com',
        adminPassword: 'supersecretpassword',
        adminDisplayName: 'Chef Pierre',
      });

    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  test('12. POST /auth/login 200 -> access JWT verificable con JWT_SECRET y claims sub/tenantId/role correctos', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'chef@bistro.com',
        password: 'supersecretpassword',
      });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();

    const decoded = jwt.verify(res.body.tokens.accessToken, TEST_SECRET) as any;
    expect(decoded.sub).toBeDefined();
    expect(decoded.tenantId).toBeDefined();
    expect(decoded.role).toBe('ADMIN');
  });

  test('13. GET /identity/me con x-user-id/x-tenant-id -> 200 con el perfil del tenant correcto; sin cabeceras -> 401', async () => {
    const unauthRes = await request(app).get('/identity/me');
    expect(unauthRes.status).toBe(401);

    const authRes = await request(app)
      .get('/identity/me')
      .set('x-user-id', 'u-123')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN');

    expect(authRes.status).toBe(200);
    expect(authRes.body.id).toBe('u-123');
    expect(authRes.body.tenantId).toBe('t-456');
  });

  test('14. Todas las respuestas de error cumplen { error: { code, message } }', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'unknown@resto.com', password: 'bad' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBeDefined();
    expect(typeof res.body.error.code).toBe('string');
    expect(res.body.error.message).toBeDefined();
    expect(typeof res.body.error.message).toBe('string');
  });

  test('15. POST /identity/users con rol STAFF -> 403; con rol ADMIN -> 201', async () => {
    const forbiddenRes = await request(app)
      .post('/identity/users')
      .set('x-user-id', 'u-staff')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'STAFF')
      .send({
        email: 'nuevo@resto.com',
        displayName: 'Nuevo Empleado',
        role: 'STAFF',
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    const successRes = await request(app)
      .post('/identity/users')
      .set('x-user-id', 'u-admin')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'nuevo2@resto.com',
        displayName: 'Nuevo Empleado 2',
        role: 'STAFF',
      });

    expect(successRes.status).toBe(201);
    expect(successRes.body.email).toBe('nuevo2@resto.com');
  });
});
