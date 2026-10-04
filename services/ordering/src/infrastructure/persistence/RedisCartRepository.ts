import Redis from 'ioredis';
import { CartDTO, CartItemDTO, CartRepository } from '@packages/shared-types';

export class RedisCartRepository implements CartRepository {
  constructor(private readonly redis: Redis) {}

  private getKey(tenantId: string, sessionId: string): string {
    return `cart:${tenantId}:${sessionId}`;
  }

  private calculateTotal(items: CartItemDTO[]): number {
    const totalCents = items.reduce((sum, item) => {
      const deltas = (item.modifiers || []).reduce(
        (dSum, m) => dSum + Math.round((m.priceDelta || 0) * 100),
        0
      );
      const unitCents = Math.round(item.unitPrice * 100);
      return sum + (unitCents + deltas) * item.quantity;
    }, 0);
    return totalCents / 100;
  }

  async get(tenantId: string, sessionId: string, ttlSeconds: number): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    multi.hgetall(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();

    const rawHash = (results?.[0]?.[1] as Record<string, string>) || {};
    const items: CartItemDTO[] = Object.values(rawHash).map((val) => JSON.parse(val));

    return {
      tenantId,
      sessionId,
      items,
      total: this.calculateTotal(items),
    };
  }

  async upsertItem(
    tenantId: string,
    sessionId: string,
    item: CartItemDTO,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const serialized = JSON.stringify(item);

    const multi = this.redis.multi();
    multi.hset(key, item.cartItemId, serialized);
    multi.expire(key, ttlSeconds);
    await multi.exec();

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async setQuantity(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    quantity: number,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);

    if (quantity <= 0) {
      return this.removeItem(tenantId, sessionId, cartItemId, ttlSeconds);
    }

    const raw = await this.redis.hget(key, cartItemId);
    if (raw) {
      const item: CartItemDTO = JSON.parse(raw);
      item.quantity = quantity;
      const deltas = (item.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
      item.lineTotal = (item.unitPrice + deltas) * quantity;

      const multi = this.redis.multi();
      multi.hset(key, cartItemId, JSON.stringify(item));
      multi.expire(key, ttlSeconds);
      await multi.exec();
    }

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async removeItem(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    multi.hdel(key, cartItemId);
    multi.expire(key, ttlSeconds);
    await multi.exec();

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async clear(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getKey(tenantId, sessionId);
    await this.redis.del(key);
  }
}
