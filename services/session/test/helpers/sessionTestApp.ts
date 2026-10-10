import { InMemoryTableRepository, InMemoryTableSessionRepository } from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

export function createSeededSessionTestApp() {
  const tableRepo = new InMemoryTableRepository();
  const sessionRepo = new InMemoryTableSessionRepository();

  tableRepo.tables.push({
    tableId: 'table-1',
    tenantId: 'tenant-100',
    label: 'Mesa 1',
    status: 'active',
    qrKey: 'valid-key',
    createdAt: new Date().toISOString(),
  });

  return createSessionApp({
    tableRepo,
    sessionRepo,
  });
}
