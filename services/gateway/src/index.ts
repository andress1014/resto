import { app } from './app';

const PORT = process.env.GATEWAY_PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Gateway running on port ${PORT}`);
  });
}
