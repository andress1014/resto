import {
  InviteUserUseCase,
  UserDTO,
  UserRepository,
  DomainError,
} from '@packages/shared-types';
import { InMemoryUserRepository } from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class InviteUserUseCaseImpl implements InviteUserUseCase {
  constructor(private readonly userRepo: UserRepository = new InMemoryUserRepository()) {}

  async execute(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: 'MANAGER' | 'STAFF';
  }): Promise<UserDTO> {
    const existing = await this.userRepo.findByEmail(input.tenantId, input.email);
    if (existing) {
      throw new DomainError('EMAIL_TAKEN', `El email ${input.email} ya está registrado en este restaurante`);
    }

    const userId = `invited-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const savedUser = await this.userRepo.save({
      id: userId,
      tenantId: input.tenantId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: 'INVITED',
      passwordHash: 'pending_invitation_hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return savedUser;
  }
}
