import {
  RefreshSessionUseCase,
  AuthTokens,
  UserRepository,
  RefreshTokenRepository,
  TokenIssuer,
  DomainError,
} from '@packages/shared-types';
import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakeTokenIssuer,
} from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class RefreshSessionUseCaseImpl implements RefreshSessionUseCase {
  constructor(
    private readonly userRepo: UserRepository = new InMemoryUserRepository(),
    private readonly refreshTokenRepo: RefreshTokenRepository = new InMemoryRefreshTokenRepository(),
    private readonly tokenIssuer: TokenIssuer = new FakeTokenIssuer()
  ) {}

  async execute(input: { refreshToken: string }): Promise<AuthTokens> {
    if (!input.refreshToken) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco requerido');
    }

    const tokenHash = `hash_${input.refreshToken}`;
    const valid = await this.refreshTokenRepo.findValidByHash(tokenHash);
    if (!valid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco inválido o expirado');
    }

    // Atomic rotation: revoke old token
    await this.refreshTokenRepo.revoke(valid.id);

    const user = await this.userRepo.findById(valid.userId);
    if (!user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Usuario no encontrado');
    }

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const newRefresh = this.tokenIssuer.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save(user.id, newRefresh.hash, expiresAt);

    return {
      accessToken,
      refreshToken: newRefresh.raw,
      expiresIn: 900,
    };
  }
}
