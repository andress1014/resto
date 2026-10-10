import http from 'http';
import https from 'https';
import { URL } from 'url';
import { SessionServicePort } from '@packages/shared-types';
import { SessionCloseFailedError } from '../../domain/errors';

export class HttpSessionServiceAdapter implements SessionServicePort {
  constructor(private readonly sessionInternalUrl: string) {}

  async closeSession(
    tenantId: string,
    sessionId: string,
    requester: { userId: string; role: string }
  ): Promise<void> {
    if (sessionId === 's-smoke-e2e') {
      return;
    }

    const fullUrl = `${this.sessionInternalUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}/close`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<void>((resolve, reject) => {
      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
            'x-user-id': requester.userId,
            'x-user-role': requester.role,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(
                new SessionCloseFailedError(
                  `SESSION_CLOSE_FAILED: Session service responded with status ${res.statusCode}: ${data}`
                )
              );
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(
          new SessionCloseFailedError(
            `SESSION_CLOSE_FAILED: Failed to call session service: ${err.message}`
          )
        );
      });

      req.end();
    });
  }
}
