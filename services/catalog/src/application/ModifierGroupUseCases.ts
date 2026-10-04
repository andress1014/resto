import { ModifierGroupDTO, ModifierGroupRepository, DomainError } from '@packages/shared-types';
import { InMemoryModifierGroupRepository } from '../infrastructure/fakes/InMemoryCatalogAdapters';

export class CreateModifierGroupUseCaseImpl {
  constructor(private readonly modifierRepo: ModifierGroupRepository = new InMemoryModifierGroupRepository()) {}

  async execute(input: {
    tenantId: string;
    name: string;
    minSelections?: number;
    maxSelections?: number;
    isRequired?: boolean;
  }): Promise<ModifierGroupDTO> {
    const minSelections = input.minSelections ?? 0;
    const maxSelections = input.maxSelections ?? 1;

    if (maxSelections < minSelections) {
      throw new DomainError('BAD_USER_INPUT', 'maxSelections no puede ser menor que minSelections');
    }

    const group: ModifierGroupDTO = {
      id: `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: input.tenantId,
      name: input.name,
      minSelections,
      maxSelections,
      isRequired: input.isRequired ?? false,
      options: [],
    };

    return this.modifierRepo.save(input.tenantId, group);
  }
}
