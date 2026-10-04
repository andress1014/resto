import { createCatalogApp } from './app';

const PORT = process.env.PORT || 4002;

if (process.env.NODE_ENV !== 'test') {
  createCatalogApp().then((app) => {
    app.listen(PORT, () => {
      console.log(`Catalog Service running on port ${PORT}`);
    });
  });
}
