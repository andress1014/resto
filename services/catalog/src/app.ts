import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './interfaces/graphql/typeDefs';
import { createResolvers } from './interfaces/graphql/resolvers';
import { buildCatalogContext, CatalogContext } from './interfaces/graphql/context';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryModifierGroupRepository,
} from './infrastructure/fakes/InMemoryCatalogAdapters';

export async function createCatalogApp(): Promise<express.Application> {
  const app: express.Application = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const categoryRepo = new InMemoryCategoryRepository();
  const productRepo = new InMemoryProductRepository();
  const modifierGroupRepo = new InMemoryModifierGroupRepository();

  const resolvers = createResolvers({
    categoryRepo,
    productRepo,
    modifierGroupRepo,
  });

  const server = new ApolloServer<CatalogContext>({
    typeDefs,
    resolvers,
    formatError: (formattedError, error: any) => {
      const original = error?.originalError;
      if (original && original.code) {
        let code = original.code;
        if (code === 'VALIDATION_ERROR') code = 'BAD_USER_INPUT';
        return {
          ...formattedError,
          extensions: {
            ...formattedError.extensions,
            code,
          },
        };
      }
      return formattedError;
    },
  });

  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        return buildCatalogContext({ req });
      },
    })
  );

  return app;
}
