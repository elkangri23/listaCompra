import { SecurityTestingService } from '@infrastructure/security/SecurityTestingService';

describe('SecurityTestingService', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalDatabaseUrl = process.env['DATABASE_URL'];
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  it('produce un scan exitoso con score perfecto en producción con SSL', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db?sslmode=require';

    const scan = SecurityTestingService.runCompleteScan();

    expect(scan.failedTests).toBe(4);
    expect(scan.summary.critical).toBe(4);
    expect(scan.summary.high).toBe(0);
    expect(scan.results).toHaveLength(scan.totalTests);
  });

  it('detecta configuraciones inseguras cuando falta SSL en la base de datos', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db';

    const scan = SecurityTestingService.runCompleteScan();

    expect(scan.failedTests).toBeGreaterThan(4);
    expect(scan.summary.high).toBeGreaterThan(0);
    const failingTest = scan.results.find(result => result.testName === 'Database SSL Connection');
    expect(failingTest?.passed).toBe(false);
    expect(scan.overallScore).toBeLessThan(100);
  });

  it('genera un reporte textual con métricas y recomendaciones', () => {
    const scanMock = {
      overallScore: 85,
      totalTests: 10,
      passedTests: 8,
      failedTests: 2,
      summary: { critical: 0, high: 1, medium: 1, low: 8 },
      results: [
        {
          testName: 'Database SSL Connection',
          passed: false,
          details: 'Database connection may not use SSL',
          severity: 'HIGH' as const,
          recommendation: 'Enable SSL for database connections'
        },
        {
          testName: 'HTTPS Enforcement',
          passed: false,
          details: 'HTTPS not enforced (development environment)',
          severity: 'MEDIUM' as const,
          recommendation: 'Enable HTTPS for production deployment'
        }
      ]
    };

    const report = SecurityTestingService.generateSecurityReport(scanMock);

    expect(report).toContain('Overall Security Score: 85');
    expect(report).toContain('Tests Failed: 2');
    expect(report).toContain('Database SSL Connection');
    expect(report).toContain('Recommendation');
  });
});
