import {
  AddCartItemUseCase,
  CartDTO,
  CartItemDTO,
  CartRepository,
  GetCartUseCase,
  RemoveCartItemUseCase,
  UpdateCartItemQuantityUseCase,
} from '@packages/shared-types';
import { canMergeCartLines } from '../domain/merge';
import { config } from '../config';

export class CartUseCases {
  constructor(private readonly cartRepo: CartRepository) {}

  addCartItem: AddCartItemUseCase = {
    execute: async (input) => {
      const currentCart = await this.cartRepo.get(
        input.tenantId,
        input.sessionId,
        config.cartTtlSeconds
      );

      // Buscar si existe línea para merge canónico
      const existingItem = (currentCart.items || []).find((line) =>
        canMergeCartLines(
          line.productId,
          line.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
          input.productId,
          input.modifiers
        )
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + input.quantity;
        return this.cartRepo.setQuantity(
          input.tenantId,
          input.sessionId,
          existingItem.cartItemId,
          newQuantity,
          config.cartTtlSeconds
        );
      }

      // Nueva línea
      const cartItemId = `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const modifiers = input.modifiers.map((m) => {
        const foundName = (input.display.modifierNames || []).find(
          (dn) => dn.optionName // fallback o match
        );
        return {
          groupId: m.groupId,
          groupName: foundName?.groupName || 'Modificador',
          optionId: m.optionId,
          optionName: foundName?.optionName || 'Opción',
          priceDelta: foundName?.priceDelta || 0,
        };
      });

      const lineDeltas = modifiers.reduce((acc, m) => acc + (m.priceDelta || 0), 0);
      const lineTotal = (input.display.unitPrice + lineDeltas) * input.quantity;

      const newItem: CartItemDTO = {
        cartItemId,
        productId: input.productId,
        productName: input.display.productName,
        unitPrice: input.display.unitPrice,
        modifiers,
        quantity: input.quantity,
        notes: input.notes,
        addedBy: input.addedBy,
        addedAt: new Date().toISOString(),
        lineTotal,
      };

      return this.cartRepo.upsertItem(
        input.tenantId,
        input.sessionId,
        newItem,
        config.cartTtlSeconds
      );
    },
  };

  updateCartItemQuantity: UpdateCartItemQuantityUseCase = {
    execute: async (input) => {
      if (input.quantity <= 0) {
        return this.cartRepo.removeItem(
          input.tenantId,
          input.sessionId,
          input.cartItemId,
          config.cartTtlSeconds
        );
      }

      return this.cartRepo.setQuantity(
        input.tenantId,
        input.sessionId,
        input.cartItemId,
        input.quantity,
        config.cartTtlSeconds
      );
    },
  };

  removeCartItem: RemoveCartItemUseCase = {
    execute: async (input) => {
      return this.cartRepo.removeItem(
        input.tenantId,
        input.sessionId,
        input.cartItemId,
        config.cartTtlSeconds
      );
    },
  };

  getCart: GetCartUseCase = {
    execute: async (input) => {
      return this.cartRepo.get(input.tenantId, input.sessionId, config.cartTtlSeconds);
    },
  };
}
