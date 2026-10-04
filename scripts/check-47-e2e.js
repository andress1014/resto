const supertestPath = require.resolve('supertest', { paths: [__dirname + '/../services/identity'] });
const request = require(supertestPath);
const { createIdentityApp } = require('../services/identity/dist/app');
const { createCatalogApp } = require('../services/catalog/dist/app');

async function run() {
  const idApp = createIdentityApp();
  const catApp = await createCatalogApp();

  // 1. Register
  const reg = await request(idApp)
    .post('/auth/register')
    .send({
      restaurantName: 'E2E Resto',
      adminEmail: 'e2e@resto.com',
      adminPassword: 'password123',
      adminDisplayName: 'E2E Admin'
    });
  console.log('1. Register status:', reg.status, 'tenantId:', reg.body.tenant?.id);

  // 2. Login
  const login = await request(idApp)
    .post('/auth/login')
    .send({
      email: 'e2e@resto.com',
      password: 'password123'
    });
  console.log('2. Login status:', login.status, 'hasToken:', !!login.body.tokens?.accessToken);

  const tenantId = reg.body.tenant.id;

  // 3. Create category via GraphQL
  const mut = await request(catApp)
    .post('/graphql')
    .set('x-tenant-id', tenantId)
    .send({
      query: 'mutation { createCategory(input: { name: "Postres" }) { id name } }'
    });
  console.log('3. Mutation status:', mut.status, 'data:', mut.body.data);

  // 4. Query categories
  const query = await request(catApp)
    .post('/graphql')
    .set('x-tenant-id', tenantId)
    .send({
      query: 'query { categories { id name } }'
    });
  console.log('4. Query status:', query.status, 'categories count:', query.body.data?.categories?.length);

  const found = query.body.data?.categories?.some(c => c.name === 'Postres');
  console.log('E2E FLOW CHECK 47 RESULT:', found ? 'SUCCESS' : 'FAILED');
  if (!found) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
