import { UseCase } from '../common/UseCase';
import {
  TableDTO,
  TableSessionDTO,
  GuestTokenClaims,
  OpenSessionRequest,
  OpenSessionResult,
  QrCodeResult,
} from './dtos';

export interface TableRepository {
  save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO>;
  findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null>;
  listByTenant(tenantId: string): Promise<TableDTO[]>;
}

export interface TableSessionRepository {
  findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null>;
  findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null>;
  save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO>;
  close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO>;
  listByTenant(tenantId: string, filter?: { status?: 'active' | 'closed'; tableId?: string }): Promise<TableSessionDTO[]>;
  touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void>;
}

export interface QrCodeGenerator {
  generate(payloadUrl: string): Promise<QrCodeResult>;
}

export interface GuestTokenIssuer {
  issue(claims: GuestTokenClaims, ttlSeconds: number): string;
}

export type CreateTableUseCase = UseCase<{ tenantId: string; label: string }, TableDTO>;
export type GenerateTableQrUseCase = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type RotateTableQrKeyUseCase = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type OpenTableSessionUseCase = UseCase<OpenSessionRequest, OpenSessionResult>;
export type GetTableSessionUseCase = UseCase<
  { tenantId: string; sessionId: string; requester: { role: string; sessionId?: string } },
  TableSessionDTO
>;
export type CloseTableSessionUseCase = UseCase<{ tenantId: string; sessionId: string }, TableSessionDTO>;
export type ListTableSessionsUseCase = UseCase<
  { tenantId: string; filter?: { status?: 'active' | 'closed'; tableId?: string } },
  TableSessionDTO[]
>;
