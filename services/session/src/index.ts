import { app } from './app';

const PORT = process.env.PORT || 4003;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Session service running on port ${PORT}`);
  });
}
