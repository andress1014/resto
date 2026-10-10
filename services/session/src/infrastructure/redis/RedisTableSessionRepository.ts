import Redis from 'ioredis';
import { TableSessionRepository, TableSessionDTO } from '@packages/shared-types';
import { RedisKeys } from './keys';

export class RedisTableSessionRepository implements TableSessionRepository {
  constructor(private readonly redis: Redis) {}

  async findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null> {
    const pointerKey = RedisKeys.tableSessionPointer(tenantId, tableId);
    const sessionId = await this.redis.get(pointerKey);
    if (!sessionId) return null;

    const session = await this.findById(tenantId, sessionId);
    if (session && session.status === 'active') {
      return session;
    }
    return null;
  }

  async findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) return null;

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) return null;
    return session;
  }

  async save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(session.sessionId);
    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const setKey = RedisKeys.tenantSessions(tenantId);

    const payload = JSON.stringify(session);
    const multi = this.redis.multi();

    multi.set(sessionKey, payload, 'EX', ttlSeconds);
    if (session.status === 'active') {
      multi.set(pointerKey, session.sessionId, 'EX', ttlSeconds);
    } else {
      multi.del(pointerKey);
    }
    multi.sadd(setKey, session.sessionId);

    await multi.exec();
    return session;
  }

  async close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) {
      throw new Error('SESSION_NOT_FOUND');
    }

    session.status = 'closed';
    session.closedAt = closedAt.toISOString();

    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const payload = JSON.stringify(session);

    // Persistir estado cerrado (mantener historial en Redis con TTL de 24h) y LIMPIAR puntero mesa-sesión
    await this.redis
      .multi()
      .set(sessionKey, payload, 'EX', 86400)
      .del(pointerKey)
      .exec();

    return session;
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'closed'; tableId?: string }
  ): Promise<TableSessionDTO[]> {
    const setKey = RedisKeys.tenantSessions(tenantId);
    const sessionIds = await this.redis.smembers(setKey);
    if (!sessionIds.length) return [];

    const keys = sessionIds.map((id) => RedisKeys.session(id));
    const rawSessions = await this.redis.mget(keys);

    const sessions: TableSessionDTO[] = [];
    for (const raw of rawSessions) {
      if (raw) {
        const parsed: TableSessionDTO = JSON.parse(raw);
        if (parsed.tenantId !== tenantId) continue;
        if (filter?.status && parsed.status !== filter.status) continue;
        if (filter?.tableId && parsed.tableId !== filter.tableId) continue;
        sessions.push(parsed);
      }
    }
    return sessions;
  }

  async touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) return;

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) return;

    session.expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const payload = JSON.stringify(session);

    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const multi = this.redis.multi();
    multi.set(sessionKey, payload, 'EX', ttlSeconds);
    if (session.status === 'active') {
      multi.expire(pointerKey, ttlSeconds);
    }
    await multi.exec();
  }
}
