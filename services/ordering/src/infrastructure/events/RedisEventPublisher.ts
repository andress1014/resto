import Redis from 'ioredis';
import { CheckoutCompletedEvent, EventPublisher, OrderEvent, ServiceCallEvent } from '@packages/shared-types';

export class RedisEventPublisher implements EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publishOrderEvent(tenantId: string, event: OrderEvent): Promise<void> {
    const channel = `tenant:${tenantId}:order-events`;
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async publishServiceCallEvent(tenantId: string, event: ServiceCallEvent): Promise<void> {
    const channel = `tenant:${tenantId}:service-calls`;
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async publishCheckoutCompleted(tenantId: string, event: CheckoutCompletedEvent): Promise<void> {
    const channel = `tenant:${tenantId}:order-events`;
    await this.redis.publish(channel, JSON.stringify(event));
  }
}
