import { createIdentityApp } from './app';

const app = createIdentityApp();
const PORT = process.env.PORT || 4001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Identity Service running on port ${PORT}`);
  });
}
