import {
  CreateServiceCallUseCase,
  EventPublisher,
  ListServiceCallsUseCase,
  ResolveServiceCallUseCase,
  ServiceCallDTO,
  ServiceCallRepository,
} from '@packages/shared-types';
import { ServiceCallNotFoundError } from '../domain/errors';
import { config } from '../config';

export class ServiceCallUseCases {
  constructor(
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  createServiceCall: CreateServiceCallUseCase = {
    execute: async (input) => {
      const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const call: ServiceCallDTO = {
        callId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        tableId: input.tableId,
        note: input.note,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const saved = await this.serviceCallRepo.save(
        input.tenantId,
        call,
        config.serviceCallTtlSeconds
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishServiceCallEvent(input.tenantId, {
          type: 'service-call.created',
          call: saved,
          occurredAt: new Date().toISOString(),
        });
      }

      return saved;
    },
  };

  resolveServiceCall: ResolveServiceCallUseCase = {
    execute: async (input) => {
      const existing = await this.serviceCallRepo.findById(input.tenantId, input.callId);
      if (!existing) {
        throw new ServiceCallNotFoundError();
      }

      if (existing.status === 'resolved') {
        return existing;
      }

      const resolved = await this.serviceCallRepo.resolve(input.tenantId, input.callId, new Date());

      if (this.eventPublisher) {
        await this.eventPublisher.publishServiceCallEvent(input.tenantId, {
          type: 'service-call.resolved',
          call: resolved,
          occurredAt: new Date().toISOString(),
        });
      }

      return resolved;
    },
  };

  listServiceCalls: ListServiceCallsUseCase = {
    execute: async (input) => {
      return this.serviceCallRepo.listByTenant(input.tenantId, input.filter);
    },
  };
}
