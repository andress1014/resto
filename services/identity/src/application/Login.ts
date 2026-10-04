import {
  LoginUseCase,
  UserDTO,
  AuthTokens,
  TenantRepository,
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  TokenIssuer,
  DomainError,
} from '@packages/shared-types';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
  FakeTokenIssuer,
} from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class LoginUseCaseImpl implements LoginUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository = new InMemoryTenantRepository(),
    private readonly userRepo: UserRepository = new InMemoryUserRepository(),
    private readonly refreshTokenRepo: RefreshTokenRepository = new InMemoryRefreshTokenRepository(),
    private readonly passwordHasher: PasswordHasher = new FakePasswordHasher(),
    private readonly tokenIssuer: TokenIssuer = new FakeTokenIssuer()
  ) {}

  async execute(input: {
    email: string;
    password: string;
    tenantSlug?: string;
  }): Promise<{ user: UserDTO; tokens: AuthTokens }> {
    let tenantId = '';
    if (input.tenantSlug) {
      const tenant = await this.tenantRepo.findBySlug(input.tenantSlug);
      if (!tenant) {
        throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas');
      }
      tenantId = tenant.id;
    }

    const user = await this.userRepo.findByEmail(tenantId, input.email);
    if (!user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas');
    }

    // Retrieve user with passwordHash
    let userWithHash: any = user;
    if (this.userRepo instanceof InMemoryUserRepository) {
      userWithHash = this.userRepo.users.find((u) => u.id === user.id);
    }

    const hashToVerify = userWithHash?.passwordHash || '';
    const isValid = await this.passwordHasher.verify(input.password, hashToVerify);
    if (!isValid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas');
    }

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const refresh = this.tokenIssuer.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save(user.id, refresh.hash, expiresAt);

    const { passwordHash, ...cleanUser } = userWithHash;

    return {
      user: cleanUser,
      tokens: {
        accessToken,
        refreshToken: refresh.raw,
        expiresIn: 900,
      },
    };
  }
}
