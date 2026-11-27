/**
 * Tests para log-redactor, rabbitmq.config y metricsRoutes.
 */

import { redact } from '../../../../src/infrastructure/security/log-redactor';
import {
  DEFAULT_RABBITMQ_CONFIG,
  RABBITMQ_CONFIGS,
  getRabbitMQConfig,
  buildRabbitMQConnectionUrl,
  validateRabbitMQConfig
} from '../../../../src/infrastructure/config/rabbitmq.config';
import request from 'supertest';
import express from 'express';
import { metricsRoutes } from '../../../../src/infrastructure/observability/metrics/metricsRoutes';
import { getMetricsCollector } from '../../../../src/infrastructure/observability/metrics/MetricsMiddleware';

describe('log-redactor', () => {
  it('redacta claves sensibles (mayúsc/minúsc incluidas)', () => {
    const out = redact({
      token: 'abc', TOTPSecret: 'x', Password: 'p', accessToken: 't',
      code: '123456', Authorization: 'Bearer x', otpauthUrl: 'otp://', backupCode: 'cc'
    });
    expect(out['token']).toBe('[REDACTED]');
    expect(out['TOTPSecret']).toBe('[REDACTED]');
    expect(out['Password']).toBe('[REDACTED]');
    expect(out['accessToken']).toBe('[REDACTED]');
    expect(out['code']).toBe('[REDACTED]');
    expect(out['Authorization']).toBe('[REDACTED]');
    expect(out['otpauthUrl']).toBe('[REDACTED]');
    expect(out['backupCode']).toBe('[REDACTED]');
  });

  it('redacta recursivamente pero no arrays ni fechas', () => {
    const out = redact({
      ok: 1,
      nested: { password: 'x', keep: 'y' },
      arr: [{ secret: 's' }],
      when: new Date('2024-01-01')
    });
    const nested = out['nested'] as any;
    expect(nested.password).toBe('[REDACTED]');
    expect(nested.keep).toBe('y');
    expect((out['arr'] as any)[0].secret).toBe('s'); // arrays pasan intactos
    expect(out['when']).toBeInstanceOf(Date);
  });

  it('no muta el original', () => {
    const original = { password: 'x', other: { token: 'y' } };
    redact(original);
    expect(original.password).toBe('x');
    expect((original.other as any).token).toBe('y');
  });
});

describe('rabbitmq.config', () => {
  it('DEFAULT_RABBITMQ_CONFIG y RABBITMQ_CONFIGS coherentes', () => {
    expect(DEFAULT_RABBITMQ_CONFIG.queues.notifications).toBeTruthy();
    expect(DEFAULT_RABBITMQ_CONFIG.outbox.processingInterval).toBeGreaterThan(0);
    expect(Object.keys(RABBITMQ_CONFIGS).length).toBeGreaterThan(0);
    const dev = (RABBITMQ_CONFIGS as Record<string, any>)['development'];
    expect(dev.connection.host).toBeTruthy();
  });

  it('getRabbitMQConfig selecciona config según NODE_ENV', () => {
    const saved = process.env['NODE_ENV'];
    try {
      process.env['NODE_ENV'] = 'test';
      expect(getRabbitMQConfig().connection.port).toBe(5673);
      process.env['NODE_ENV'] = 'production';
      expect(getRabbitMQConfig().outbox.processingInterval).toBe(10000);
      process.env['NODE_ENV'] = 'development';
      expect(getRabbitMQConfig().outbox.processingInterval).toBe(2000);
    } finally {
      if (saved === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = saved;
    }
  });

  it('buildRabbitMQConnectionUrl compone la URL con credenciales', () => {
    const url = buildRabbitMQConnectionUrl({
      host: 'h1', port: 5673, username: 'u', password: 'p',
      vhost: 'vh', connectionTimeout: 1, heartbeat: 1, maxRetries: 1, retryDelay: 1
    } as any);
    expect(url).toContain('amqp://u:p@h1:5673/vh');

    expect(buildRabbitMQConnectionUrl()).toContain('amqp://');
  });

  it('validateRabbitMQConfig marca errores de campos vacíos', () => {
    const bad = validateRabbitMQConfig({
      ...DEFAULT_RABBITMQ_CONFIG,
      connection: { ...DEFAULT_RABBITMQ_CONFIG.connection, host: '' },
      publisher: { ...DEFAULT_RABBITMQ_CONFIG.publisher, exchangeName: '' }
    } as any);
    expect(bad.isValid).toBe(false);
    expect(bad.errors.length).toBeGreaterThanOrEqual(2);

    const ok = validateRabbitMQConfig(DEFAULT_RABBITMQ_CONFIG);
    expect(ok.isValid).toBe(true);
    expect(ok.errors).toHaveLength(0);
  });
});

describe('metricsRoutes', () => {
  const app = express();
  app.use('/metrics', metricsRoutes);

  it('GET /metrics devuelve métricas', async () => {
    getMetricsCollector().recordRequest('GET', '/x', 10, 200);
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.system).toBeTruthy();
    expect(res.body.endpoints).toBeTruthy();
  });

  it('GET /metrics/endpoint/:method/:path', async () => {
    getMetricsCollector().recordRequest('GET', '/x', 10, 200);
    const res = await request(app).get('/metrics/endpoint/GET/%2Fx');
    expect(res.status).toBe(200);
  });

  it('DELETE /metrics resetea', async () => {
    const res = await request(app).delete('/metrics');
    expect(res.status).toBe(200);
  });

  it('GET /metrics/health', async () => {
    const res = await request(app).get('/metrics/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('metrics');
  });
});
