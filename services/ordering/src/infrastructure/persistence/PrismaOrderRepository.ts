import { PrismaClient } from '@prisma/client';
import {
  OrderDTO,
  OrderItemDTO,
  OrderModifierDTO,
  OrderRepository,
  OrderStatus,
} from '@packages/shared-types';

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDTO(record: any): OrderDTO {
    const items: OrderItemDTO[] = (record.items || []).map((item: any) => {
      const modifiers: OrderModifierDTO[] = (item.modifiers || []).map((mod: any) => ({
        groupId: mod.groupId,
        groupName: mod.groupName,
        optionId: mod.optionId,
        optionName: mod.optionName,
        priceDelta: Number(mod.priceDelta),
      }));

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        notes: item.notes,
        modifiers,
      };
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      tableId: record.tableId,
      status: record.status,
      total: Number(record.total),
      items,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      cancelledAt: record.cancelledAt
        ? record.cancelledAt instanceof Date
          ? record.cancelledAt.toISOString()
          : record.cancelledAt
        : undefined,
    };
  }

  async save(tenantId: string, order: OrderDTO): Promise<OrderDTO> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          id: order.id,
          tenantId,
          sessionId: order.sessionId,
          tableId: order.tableId,
          status: order.status as any,
          total: order.total,
          items: {
            create: order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              notes: item.notes,
              modifiers: {
                create: (item.modifiers || []).map((mod) => ({
                  groupId: mod.groupId,
                  groupName: mod.groupName,
                  optionId: mod.optionId,
                  optionName: mod.optionName,
                  priceDelta: mod.priceDelta,
                })),
              },
            })),
          },
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      });

      return this.mapToDTO(created);
    });
  }

  async findById(tenantId: string, id: string): Promise<OrderDTO | null> {
    const record = await this.prisma.order.findFirst({
      where: { tenantId, id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return record ? this.mapToDTO(record) : null;
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'PLACED' | 'CANCELLED'; tableId?: string }
  ): Promise<OrderDTO[]> {
    const records = await this.prisma.order.findMany({
      where: {
        tenantId,
        ...(filter?.status ? { status: filter.status as any } : {}),
        ...(filter?.tableId ? { tableId: filter.tableId } : {}),
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToDTO(r));
  }

  async listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]> {
    const records = await this.prisma.order.findMany({
      where: { tenantId, sessionId },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToDTO(r));
  }

  async cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt,
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    updatedAt: Date
  ): Promise<OrderDTO> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        updatedAt,
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }
}
