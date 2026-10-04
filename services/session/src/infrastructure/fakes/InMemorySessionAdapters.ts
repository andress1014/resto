import {
  TableRepository,
  TableSessionRepository,
  QrCodeGenerator,
  TableDTO,
  TableSessionDTO,
  QrCodeResult,
} from '@packages/shared-types';

export class InMemoryTableRepository implements TableRepository {
  public tables: (TableDTO & { qrKey: string })[] = [
    {
      tableId: 'tb-1',
      tenantId: 't-1',
      label: 'Mesa 1',
      status: 'active',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
    {
      tableId: 'tb-inactive',
      tenantId: 't-1',
      label: 'Mesa Inactiva',
      status: 'inactive',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
  ];

  async save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO> {
    const existingIndex = this.tables.findIndex(
      (t) => t.tenantId === tenantId && t.tableId === table.tableId
    );
    if (existingIndex >= 0) {
      this.tables[existingIndex] = { ...table, tenantId };
    } else {
      this.tables.push({ ...table, tenantId });
    }
    const { qrKey: _, ...dto } = table;
    return dto;
  }

  async findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null> {
    const found = this.tables.find((t) => t.tenantId === tenantId && t.tableId === tableId);
    return found ? { ...found } : null;
  }

  async listByTenant(tenantId: string): Promise<TableDTO[]> {
    return this.tables
      .filter((t) => t.tenantId === tenantId)
      .map(({ qrKey: _, ...dto }) => dto);
  }
}

export class InMemoryTableSessionRepository implements TableSessionRepository {
  public sessions: TableSessionDTO[] = [];

  async findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null> {
    const found = this.sessions.find(
      (s) => s.tenantId === tenantId && s.tableId === tableId && s.status === 'active'
    );
    return found ? { ...found } : null;
  }

  async findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const found = this.sessions.find((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    return found ? { ...found } : null;
  }

  async save(tenantId: string, session: TableSessionDTO, _ttlSeconds: number): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === session.sessionId);
    if (index >= 0) {
      this.sessions[index] = { ...session, tenantId };
    } else {
      this.sessions.push({ ...session, tenantId });
    }
    return session;
  }

  async close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index === -1) {
      throw new Error('SESSION_NOT_FOUND');
    }
    this.sessions[index].status = 'closed';
    this.sessions[index].closedAt = closedAt.toISOString();
    return { ...this.sessions[index] };
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'closed'; tableId?: string }
  ): Promise<TableSessionDTO[]> {
    return this.sessions.filter((s) => {
      if (s.tenantId !== tenantId) return false;
      if (filter?.status && s.status !== filter.status) return false;
      if (filter?.tableId && s.tableId !== filter.tableId) return false;
      return true;
    });
  }

  async touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index !== -1) {
      this.sessions[index].expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    }
  }
}

export class FakeQrCodeGenerator implements QrCodeGenerator {
  async generate(payloadUrl: string): Promise<QrCodeResult> {
    return {
      url: payloadUrl,
      pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    };
  }
}
