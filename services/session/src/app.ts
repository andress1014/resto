import express from 'express';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createTablesRouter } from './interfaces/http/tables.routes';
import { createSessionsRouter } from './interfaces/http/sessions.routes';
import {
  CreateTableUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from './application/TableUseCases';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
  ListTableSessionsUseCaseImpl,
} from './application/SessionUseCases';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
} from './infrastructure/fakes/InMemorySessionAdapters';
import { JwtGuestTokenIssuer } from './infrastructure/security/JwtGuestTokenIssuer';
import { QrcodeGeneratorAdapter } from './infrastructure/qr/QrcodeGeneratorAdapter';
import { config } from './config';

const sharedTableRepo = new InMemoryTableRepository();
const sharedSessionRepo = new InMemoryTableSessionRepository();
const sharedTokenIssuer = new JwtGuestTokenIssuer(config.JWT_SECRET);
const sharedQrGenerator = new QrcodeGeneratorAdapter();

// Pre-seed tables for integration testing
sharedTableRepo.tables.push({
  tableId: 'table-1',
  tenantId: 'tenant-100',
  label: 'Mesa 1',
  status: 'active',
  qrKey: 'valid-key',
  createdAt: new Date().toISOString(),
});

export function createSessionApp(): express.Application {
  const app: express.Application = express();
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const createTableUseCase = new CreateTableUseCaseImpl(sharedTableRepo);
  const generateTableQrUseCase = new GenerateTableQrUseCaseImpl(
    sharedTableRepo,
    sharedQrGenerator,
    config.PWA_BASE_URL
  );
  const rotateTableQrKeyUseCase = new RotateTableQrKeyUseCaseImpl(
    sharedTableRepo,
    sharedQrGenerator,
    config.PWA_BASE_URL
  );

  const openTableSessionUseCase = new OpenTableSessionUseCaseImpl(
    sharedSessionRepo,
    sharedTableRepo,
    sharedTokenIssuer,
    config.SESSION_TTL_SECONDS
  );
  const closeTableSessionUseCase = new CloseTableSessionUseCaseImpl(sharedSessionRepo);
  const getTableSessionUseCase = new GetTableSessionUseCaseImpl(sharedSessionRepo);
  const listTableSessionsUseCase = new ListTableSessionsUseCaseImpl(sharedSessionRepo);

  // Mount routers
  app.use(
    '/tables',
    createTablesRouter({
      tableRepo: sharedTableRepo,
      createTableUseCase,
      generateTableQrUseCase,
      rotateTableQrKeyUseCase,
    })
  );

  app.use(
    '/sessions',
    createSessionsRouter({
      openTableSessionUseCase,
      closeTableSessionUseCase,
      getTableSessionUseCase,
      listTableSessionsUseCase,
    })
  );

  // Error handling
  app.use(errorHandler);

  return app;
}

export const app = createSessionApp();
