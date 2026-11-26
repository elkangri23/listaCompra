import * as fs from 'fs';
import { persistEnvVars, resolveEnvFilePath } from '../../../../src/infrastructure/config/EnvFileWriter';

describe('EnvFileWriter (persistencia de config IA en .env, Opción B)', () => {
  const tmp = 'C:/Users/amoles/AppData/Local/Temp';
  let envPath: string;

  beforeEach(() => {
    envPath = `${tmp}/env-test-${Date.now()}.env`;
    fs.writeFileSync(
      envPath,
      '# Comentario inicial\nAI_PROVIDER=freellmapi\nFREE_LLMAPI_API_KEY=key-antigua-1234567890123456\nDB_HOST=localhost\n'
    );
  });

  afterEach(() => {
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
  });

  it('actualiza la variable existente y preserva el resto', () => {
    const changed = persistEnvVars({ FREE_LLMAPI_API_KEY: 'nueva-key-abcdef0123456789' }, envPath);
    const out = fs.readFileSync(envPath, 'utf-8');

    expect(changed).toBe(true);
    expect(out).toContain('AI_PROVIDER=freellmapi');
    expect(out).toContain('FREE_LLMAPI_API_KEY=nueva-key-abcdef0123456789');
    expect(out).toContain('# Comentario inicial');
    expect(out).toContain('DB_HOST=localhost');
    expect(out).not.toContain('key-antigua');
  });

  it('cambia el proveedor y añade variables nuevas', () => {
    persistEnvVars({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-xxxx' }, envPath);
    const out = fs.readFileSync(envPath, 'utf-8');
    expect(out).toContain('AI_PROVIDER=anthropic');
    expect(out).toContain('ANTHROPIC_API_KEY=sk-ant-xxxx');
    expect(out).toContain('DB_HOST=localhost');
  });

  it('crea el fichero si no existe', () => {
    const nuevo = `${tmp}/env-nuevo-${Date.now()}.env`;
    try {
      persistEnvVars({ AI_PROVIDER: 'google' }, nuevo);
      expect(fs.readFileSync(nuevo, 'utf-8')).toContain('AI_PROVIDER=google');
    } finally {
      if (fs.existsSync(nuevo)) fs.unlinkSync(nuevo);
    }
  });

  it('devuelve false si no hay cambios reales', () => {
    expect(persistEnvVars({ AI_PROVIDER: 'freellmapi' }, envPath)).toBe(false);
  });

  it('preserva CRLF del fichero original', () => {
    fs.writeFileSync(envPath, 'A=1\r\nAI_PROVIDER=freellmapi\r\n', 'utf-8');
    persistEnvVars({ AI_PROVIDER: 'openai' }, envPath);
    const out = fs.readFileSync(envPath, 'utf-8');
    expect(out).toContain('AI_PROVIDER=openai');
    expect(out).toContain('\r\n');
  });

  it('valores con espacios se citan y se recuperan bien', () => {
    persistEnvVars({ AI_MODEL: 'mi modelo con espacios' }, envPath);
    const out = fs.readFileSync(envPath, 'utf-8');
    expect(out).toMatch(/AI_MODEL='mi modelo con espacios'/);
    // idempotente: reescribir el mismo valor no cambia
    expect(persistEnvVars({ AI_MODEL: 'mi modelo con espacios' }, envPath)).toBe(false);
  });

  it('ignora nombres de variable inválidos', () => {
    const changed = persistEnvVars({ 'mal nombre!': 'x', AI_PROVIDER: 'freellmapi' } as any, envPath);
    expect(changed).toBe(false);
    expect(fs.readFileSync(envPath, 'utf-8')).not.toContain('mal nombre');
  });

  it('ruta inexistente (directorio) devuelve false sin lanzar', () => {
    expect(persistEnvVars({ A: '1' }, `${tmp}/no-existe-dir/env.env`)).toBe(false);
  });

  it('resolveEnvFilePath respeta ENV_FILE_PATH', () => {
    const prev = process.env['ENV_FILE_PATH'];
    process.env['ENV_FILE_PATH'] = '/tmp/custom.env';
    expect(resolveEnvFilePath()).toBe('/tmp/custom.env');
    if (prev === undefined) delete process.env['ENV_FILE_PATH'];
    else process.env['ENV_FILE_PATH'] = prev as string;
  });
});
