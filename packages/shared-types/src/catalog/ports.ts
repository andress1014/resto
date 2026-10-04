import { CategoryDTO, ProductDTO, ModifierGroupDTO, ModifierOptionDTO } from './dtos';

export interface CategoryRepository {
  listByTenant(tenantId: string): Promise<CategoryDTO[]>;
  findById(tenantId: string, id: string): Promise<CategoryDTO | null>;
  save(tenantId: string, category: CategoryDTO): Promise<CategoryDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  hasProducts(tenantId: string, id: string): Promise<boolean>;
}

export interface ProductRepository {
  listByTenant(tenantId: string, filter?: { categoryId?: string; onlyAvailable?: boolean }): Promise<ProductDTO[]>;
  findById(tenantId: string, id: string): Promise<ProductDTO | null>;
  save(tenantId: string, product: ProductDTO): Promise<ProductDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  setAvailability(tenantId: string, id: string, isAvailable: boolean): Promise<ProductDTO>;
  attachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void>;
  detachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void>;
}

export interface ModifierGroupRepository {
  listByTenant(tenantId: string): Promise<ModifierGroupDTO[]>;
  findById(tenantId: string, id: string): Promise<ModifierGroupDTO | null>;
  save(tenantId: string, group: ModifierGroupDTO): Promise<ModifierGroupDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  addOption(tenantId: string, groupId: string, option: ModifierOptionDTO): Promise<ModifierOptionDTO>;
  removeOption(tenantId: string, optionId: string): Promise<void>;
}
