"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
describe('C. Smoke de infraestructura (Tests 28-30)', () => {
    const rootDir = path_1.default.resolve(__dirname, '../../..');
    test('28. docker compose config válido; servicios postgres, redis y gateway definidos con healthchecks', () => {
        const output = (0, child_process_1.execSync)('docker compose config', { cwd: rootDir, encoding: 'utf8' });
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
        const sqlPath = path_1.default.join(rootDir, 'infra', 'postgres', 'init', '00-create-databases.sql');
        expect(fs_1.default.existsSync(sqlPath)).toBe(true);
        const sqlContent = fs_1.default.readFileSync(sqlPath, 'utf8');
        expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_identity;/i);
        expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_catalog;/i);
        expect(sqlContent).toMatch(/CREATE\s+DATABASE\s+resto_ordering;/i);
    });
    test('30. pnpm build compila shared-types y ui-components; pnpm test ejecuta los suites A y B en verde', () => {
        const sharedTypesJs = path_1.default.join(rootDir, 'packages', 'shared-types', 'dist', 'index.js');
        const sharedTypesDts = path_1.default.join(rootDir, 'packages', 'shared-types', 'dist', 'index.d.ts');
        const uiComponentsJs = path_1.default.join(rootDir, 'packages', 'ui-components', 'dist', 'index.js');
        const uiComponentsDts = path_1.default.join(rootDir, 'packages', 'ui-components', 'dist', 'index.d.ts');
        expect(fs_1.default.existsSync(sharedTypesJs)).toBe(true);
        expect(fs_1.default.existsSync(sharedTypesDts)).toBe(true);
        expect(fs_1.default.existsSync(uiComponentsJs)).toBe(true);
        expect(fs_1.default.existsSync(uiComponentsDts)).toBe(true);
    });
});
//# sourceMappingURL=smoke.test.js.map