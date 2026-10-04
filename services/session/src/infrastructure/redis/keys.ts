export const RedisKeys = {
  table: (tenantId: string, tableId: string) => `table:${tenantId}:${tableId}`,
  tenantTables: (tenantId: string) => `tenant:${tenantId}:tables`,
  session: (sessionId: string) => `session:${sessionId}`,
  tableSessionPointer: (tenantId: string, tableId: string) => `tenant:${tenantId}:table:${tableId}:session`,
  tenantSessions: (tenantId: string) => `tenant:${tenantId}:sessions`,
};
