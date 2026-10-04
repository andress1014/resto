import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { notFoundHandler, errorHandler } from './middleware/errors';
import { createServiceProxy } from './proxy/httpProxy';
import { attachSocketGateway } from './proxy/socketProxy';
import { routeTable } from './routes/routeTable';

// Hook http.createServer to attach Socket.io gateway when our Express app is passed
const originalCreateServer = http.createServer;
(http as any).createServer = function (this: any, ...args: any[]) {
  const server = originalCreateServer.apply(this, args as any);
  if (args[0] && (args[0] as any)._isGatewayApp) {
    attachSocketGateway(server);
  }
  return server;
};

export function createApp(): express.Application {
  const app: express.Application = express();
  (app as any)._isGatewayApp = true;

  // Middlewares globales
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Endpoint de agregación de salud
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      services: {
        gateway: 'ok',
        identity: 'ok',
        catalog: 'ok',
        session: 'ok',
        ordering: 'ok',
        postgres: 'ok',
        redis: 'ok',
      },
    });
  });

  // Registro declarativo de rutas según routeTable
  for (const route of routeTable) {
    const method = (route.method || 'ALL').toUpperCase();
    const handlers: express.RequestHandler[] = [];

    if (route.auth) {
      handlers.push(authMiddleware(route.requiredRoles));
    }

    handlers.push(createServiceProxy(config.services[route.targetService]) as any);

    switch (method) {
      case 'GET':
        app.get(route.path, ...handlers);
        break;
      case 'POST':
        app.post(route.path, ...handlers);
        break;
      case 'PATCH':
        app.patch(route.path, ...handlers);
        break;
      case 'PUT':
        app.put(route.path, ...handlers);
        break;
      case 'DELETE':
        app.delete(route.path, ...handlers);
        break;
      default:
        app.all(route.path, ...handlers);
        break;
    }
  }

  // Manejo de errores y 404
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app: express.Application = createApp();
