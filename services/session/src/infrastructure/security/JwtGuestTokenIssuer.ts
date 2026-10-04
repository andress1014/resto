import jwt from 'jsonwebtoken';
import { GuestTokenIssuer, GuestTokenClaims } from '@packages/shared-types';

export class JwtGuestTokenIssuer implements GuestTokenIssuer {
  constructor(private readonly secret: string = 'super-secret-jwt-key-oleada-0') {}

  issue(claims: GuestTokenClaims, ttlSeconds: number): string {
    const payload = {
      sub: `guest:${claims.sessionId}`,
      tenantId: claims.tenantId,
      role: 'guest',
      sessionId: claims.sessionId,
    };

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: ttlSeconds,
    });
  }
}
