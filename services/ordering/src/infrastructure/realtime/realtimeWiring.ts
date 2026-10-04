import { EventSubscriber, RealtimeEmitter } from '@packages/shared-types';

export function wireRealtimeEvents(subscriber: EventSubscriber, emitter: RealtimeEmitter): void {
  subscriber.onOrderEvent((event) => {
    if (event.type === 'order.created') {
      const payload = {
        order: event.order,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.order.tenantId, 'order:created', payload);
      emitter.emitToSession(event.order.sessionId, 'order:created', payload);
    } else if (event.type === 'order.status-changed') {
      const payload = {
        orderId: event.order.id,
        status: event.order.status,
        previousStatus: event.previousStatus || '',
        order: event.order,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.order.tenantId, 'order:status-changed', payload);
      emitter.emitToSession(event.order.sessionId, 'order:status-changed', payload);
    }
  });

  subscriber.onServiceCallEvent((event) => {
    if (event.type === 'service-call.created') {
      const payload = {
        call: event.call,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.call.tenantId, 'service-call:created', payload);
    } else if (event.type === 'service-call.resolved') {
      const payload = {
        call: event.call,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.call.tenantId, 'service-call:resolved', payload);
      emitter.emitToSession(event.call.sessionId, 'service-call:resolved', payload);
    }
  });
}
