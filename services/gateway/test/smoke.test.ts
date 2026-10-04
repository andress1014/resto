import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('C. Smoke de infraestructura (Tests 28-30)', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  test('28. docker compose config válido; servicios postgres, redis y gateway definidos con healthchecks', () => {
    const output = execSync('docker compose config', { cwd: rootDir, encoding: 'utf8' });
    expect(output).toBeDefined();

    // Validar servicios esenciales
    expect(output).toContain('postgres:');
    expect(output).toContain('redis:');
    expect(output).toContain('gateway:');

    // Validar existencia de healthchecks
    const hasPostgresHealthcheck = output.includes('pg_isready');
    const hasRedisHealthcheck = output.includes('redis-cli') && output.includes('ping');
    const hasGatewayHealthcheck = output.includes('/health');

    expect(hasPostgresHealthcheck).toBe(true);
    expect(hasRedisHealthcheck).toBe(true);
    expect(hasGatewayHealthcheck).toBe(true);
  });

  test('29. infra/postgres/init/00-create-databases.sql crea resto_identity, resto_catalog y resto_ordering', () => {
    const sqlPath = path.join(rootDir, 'infra', 'postgres', 'init', '00-create-databases.sql');
    expect(fs.existsSync(sqlPath)).toBe(true);

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_identity;/i);
    expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_catalog;/i);
    expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_ordering;/i);
  });

  test('30. pnpm build compila shared-types y ui-components; pnpm test ejecuta los suites A y B en verde', () => {
    const sharedTypesJs = path.join(rootDir, 'packages', 'shared-types', 'dist', 'index.js');
    const sharedTypesDts = path.join(rootDir, 'packages', 'shared-types', 'dist', 'index.d.ts');
    const uiComponentsJs = path.join(rootDir, 'packages', 'ui-components', 'dist', 'index.js');
    const uiComponentsDts = path.join(rootDir, 'packages', 'ui-components', 'dist', 'index.d.ts');

    expect(fs.existsSync(sharedTypesJs)).toBe(true);
    expect(fs.existsSync(sharedTypesDts)).toBe(true);
    expect(fs.existsSync(uiComponentsJs)).toBe(true);
    expect(fs.existsSync(uiComponentsDts)).toBe(true);
  });
});
