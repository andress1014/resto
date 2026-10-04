import {
  TableDTO,
  QrCodeResult,
  TableRepository,
  QrCodeGenerator,
  DomainError,
} from '@packages/shared-types';

export class CreateTableUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

  async execute(input: { tenantId: string; label: string }): Promise<TableDTO> {
    const tableId = `table-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const qrKey = Math.random().toString(36).substring(2, 10);

    const table = {
      tableId,
      tenantId: input.tenantId,
      label: input.label,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    return this.tableRepo.save(input.tenantId, { ...table, qrKey });
  }
}

export class GenerateTableQrUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly qrGenerator: QrCodeGenerator,
    private readonly baseUrl: string = 'http://localhost:3000'
  ) {}

  async execute(input: { tenantId: string; tableId: string }): Promise<QrCodeResult> {
    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${table.qrKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}

export class RotateTableQrKeyUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly qrGenerator: QrCodeGenerator,
    private readonly baseUrl: string = 'http://localhost:3000'
  ) {}

  async execute(input: { tenantId: string; tableId: string }): Promise<QrCodeResult> {
    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    const newKey = `rotated-${Math.random().toString(36).substring(2, 10)}`;
    await this.tableRepo.save(input.tenantId, {
      ...table,
      qrKey: newKey,
    });

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${newKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}
