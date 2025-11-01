import { execSync } from 'node:child_process';

describe('Compilación del proyecto', () => {
  it('debería compilar sin errores de TypeScript', () => {
    const tscPath = require.resolve('typescript/bin/tsc');
    expect(() => execSync(`node ${tscPath} --noEmit`, { stdio: 'pipe' })).not.toThrow();
  });
});
