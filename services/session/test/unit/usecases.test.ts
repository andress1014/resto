import jwt from 'jsonwebtoken';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
} from '../../src/application/SessionUseCases';
import {
  CreateTableUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from '../../src/application/TableUseCases';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
  FakeQrCodeGenerator,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { JwtGuestTokenIssuer } from '../../src/infrastructure/security/JwtGuestTokenIssuer';

describe('A. Session — unitarios de casos de uso (Tests 1-10)', () => {
  let tableRepo: InMemoryTableRepository;
  let sessionRepo: InMemoryTableSessionRepository;
  let tokenIssuer: JwtGuestTokenIssuer;
  let qrGenerator: FakeQrCodeGenerator;

  let openSession: OpenTableSessionUseCaseImpl;
  let closeSession: CloseTableSessionUseCaseImpl;
  let getSession: GetTableSessionUseCaseImpl;
  let createTable: CreateTableUseCaseImpl;
  let generateQr: GenerateTableQrUseCaseImpl;
  let rotateQr: RotateTableQrKeyUseCaseImpl;

  beforeEach(() => {
    tableRepo = new InMemoryTableRepository();
    sessionRepo = new InMemoryTableSessionRepository();
    tokenIssuer = new JwtGuestTokenIssuer('test-secret');
    qrGenerator = new FakeQrCodeGenerator();

    openSession = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);
    closeSession = new CloseTableSessionUseCaseImpl(sessionRepo);
    getSession = new GetTableSessionUseCaseImpl(sessionRepo);
    createTable = new CreateTableUseCaseImpl(tableRepo);
    generateQr = new GenerateTableQrUseCaseImpl(tableRepo, qrGenerator);
    rotateQr = new RotateTableQrKeyUseCaseImpl(tableRepo, qrGenerator);
  });

  test('1. OpenTableSession crea sesión con tenantId/tableId/status=active/createdAt/expiresAt, y expiresAt = createdAt + TTL', async () => {
    const result = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    expect(result.session.tenantId).toBe('t-1');
    expect(result.session.tableId).toBe('tb-1');
    expect(result.session.status).toBe('active');
    expect(result.session.createdAt).toBeDefined();
    expect(result.session.expiresAt).toBeDefined();
    const createdTime = new Date(result.session.createdAt).getTime();
    const expiresTime = new Date(result.session.expiresAt).getTime();
    expect(expiresTime).toBeGreaterThanOrEqual(createdTime + 14400 * 1000 - 1000);
  });

  test('2. OpenTableSession con sesión activa existente en la mesa -> devuelve la existente y NO crea otra (idempotente)', async () => {
    const res1 = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    const res2 = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    expect(res2.session.sessionId).toBe(res1.session.sessionId);
  });

  test('3. OpenTableSession con qrKey incorrecto -> QR_KEY_INVALID', async () => {
    await expect(
      openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'wrong-key' })
    ).rejects.toThrow('QR_KEY_INVALID');
  });

  test('4. OpenTableSession sobre mesa inexistente -> TABLE_NOT_FOUND; sobre mesa inactive -> TABLE_INACTIVE', async () => {
    await expect(
      openSession.execute({ tenantId: 't-1', tableId: 'nonexistent', qrKey: 'k-1' })
    ).rejects.toThrow('TABLE_NOT_FOUND');

    await expect(
      openSession.execute({ tenantId: 't-1', tableId: 'tb-inactive', qrKey: 'k-1' })
    ).rejects.toThrow('TABLE_INACTIVE');
  });

  test('5. CloseTableSession -> status=closed + closedAt; una nueva apertura posterior crea sesión NUEVA', async () => {
    const open1 = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    const closed = await closeSession.execute({ tenantId: 't-1', sessionId: open1.session.sessionId });
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeDefined();

    const open2 = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    expect(open2.session.sessionId).not.toBe(open1.session.sessionId);
  });

  test('6. CloseTableSession sobre sesión ya cerrada -> idempotente, devuelve la cerrada sin error', async () => {
    const open1 = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });
    await closeSession.execute({ tenantId: 't-1', sessionId: open1.session.sessionId });
    const closedAgain = await closeSession.execute({ tenantId: 't-1', sessionId: open1.session.sessionId });
    expect(closedAgain.status).toBe('closed');
  });

  test('7. GetTableSession de otro tenant -> SESSION_NOT_FOUND (aislamiento); guest con sessionId distinto -> FORBIDDEN', async () => {
    const open = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: 'k-1' });

    await expect(
      getSession.execute({
        tenantId: 'tenant-other',
        sessionId: open.session.sessionId,
        requester: { role: 'staff' },
      })
    ).rejects.toThrow('SESSION_NOT_FOUND');

    await expect(
      getSession.execute({
        tenantId: 't-1',
        sessionId: open.session.sessionId,
        requester: { role: 'guest', sessionId: 'different-session-id' },
      })
    ).rejects.toThrow('FORBIDDEN');
  });

  test('8. GuestTokenIssuer.issue produce claims { role: "guest", tenantId, sessionId } y exp = now + ttlSeconds', () => {
    const token = tokenIssuer.issue({ tenantId: 't-1', sessionId: 's-100', role: 'guest' }, 14400);
    expect(token).toBeDefined();
    const decoded: any = jwt.decode(token);
    expect(decoded.role).toBe('guest');
    expect(decoded.tenantId).toBe('t-1');
    expect(decoded.sessionId).toBe('s-100');
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('9. GenerateTableQr devuelve url con formato /t/{tenantId}/{tableId}?k=... y pngDataUrl con prefijo data:image/png;base64,', async () => {
    const qr = await generateQr.execute({ tenantId: 't-1', tableId: 'tb-1' });
    expect(qr.url).toMatch(/\/t\/t-1\/tb-1\?k=/);
    expect(qr.pngDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  test('10. RotateTableQrKey -> el qrKey anterior deja de abrir (QR_KEY_INVALID) y el nuevo abre', async () => {
    const initialQr = await generateQr.execute({ tenantId: 't-1', tableId: 'tb-1' });
    const oldKey = initialQr.url.split('k=')[1];

    const rotatedQr = await rotateQr.execute({ tenantId: 't-1', tableId: 'tb-1' });
    const newKey = rotatedQr.url.split('k=')[1];
    expect(newKey).not.toBe(oldKey);

    await expect(
      openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: oldKey })
    ).rejects.toThrow('QR_KEY_INVALID');

    const opened = await openSession.execute({ tenantId: 't-1', tableId: 'tb-1', qrKey: newKey });
    expect(opened.session.status).toBe('active');
  });
});
