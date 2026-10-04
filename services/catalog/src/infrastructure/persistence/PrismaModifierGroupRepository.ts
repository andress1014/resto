import { PrismaClient } from '../../generated/client';
import {
  ModifierGroupRepository,
  ModifierGroupDTO,
  ModifierOptionDTO,
} from '@packages/shared-types';

export class PrismaModifierGroupRepository implements ModifierGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(tenantId: string): Promise<ModifierGroupDTO[]> {
    const list = await this.prisma.modifierGroup.findMany({
      where: { tenantId },
      include: { options: true },
    });

    return list.map((g) => ({
      id: g.id,
      tenantId: g.tenantId,
      name: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      isRequired: g.isRequired,
      options: g.options.map((o) => ({
        id: o.id,
        groupId: o.groupId,
        name: o.name,
        priceDelta: Number(o.priceDelta),
        isDefault: o.isDefault,
      })),
    }));
  }

  async findById(tenantId: string, id: string): Promise<ModifierGroupDTO | null> {
    const g = await this.prisma.modifierGroup.findFirst({
      where: { tenantId, id },
      include: { options: true },
    });

    if (!g) return null;

    return {
      id: g.id,
      tenantId: g.tenantId,
      name: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      isRequired: g.isRequired,
      options: g.options.map((o) => ({
        id: o.id,
        groupId: o.groupId,
        name: o.name,
        priceDelta: Number(o.priceDelta),
        isDefault: o.isDefault,
      })),
    };
  }

  async save(tenantId: string, group: ModifierGroupDTO): Promise<ModifierGroupDTO> {
    const saved = await this.prisma.modifierGroup.upsert({
      where: { id: group.id },
      update: {
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        isRequired: group.isRequired,
      },
      create: {
        id: group.id,
        tenantId,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        isRequired: group.isRequired,
      },
      include: { options: true },
    });

    return {
      id: saved.id,
      tenantId: saved.tenantId,
      name: saved.name,
      minSelections: saved.minSelections,
      maxSelections: saved.maxSelections,
      isRequired: saved.isRequired,
      options: saved.options.map((o) => ({
        id: o.id,
        groupId: o.groupId,
        name: o.name,
        priceDelta: Number(o.priceDelta),
        isDefault: o.isDefault,
      })),
    };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.modifierGroup.deleteMany({
      where: { tenantId, id },
    });
  }

  async addOption(tenantId: string, groupId: string, option: ModifierOptionDTO): Promise<ModifierOptionDTO> {
    const group = await this.prisma.modifierGroup.findFirst({ where: { tenantId, id: groupId } });
    if (!group) throw new Error('Modifier group not found');

    const created = await this.prisma.modifierOption.create({
      data: {
        id: option.id,
        groupId,
        name: option.name,
        priceDelta: option.priceDelta,
        isDefault: option.isDefault ?? false,
      },
    });

    return {
      id: created.id,
      groupId: created.groupId,
      name: created.name,
      priceDelta: Number(created.priceDelta),
      isDefault: created.isDefault,
    };
  }

  async removeOption(tenantId: string, optionId: string): Promise<void> {
    const option = await this.prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: { group: true },
    });

    if (option && option.group.tenantId === tenantId) {
      await this.prisma.modifierOption.delete({
        where: { id: optionId },
      });
    }
  }
}
