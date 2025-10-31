/**
 * Test básico para verificar el funcionamiento del rate limiting administrativo
 */

import { createAdminRateLimitMiddleware, getRateLimitInfo } from '../../../../../src/infrastructure/http/middlewares/adminRateLimitMiddleware';

describe('Admin Rate Limit Middleware', () => {
  describe('createAdminRateLimitMiddleware', () => {
    it('debería crear el middleware sin errores', () => {
      const middleware = createAdminRateLimitMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('getRateLimitInfo', () => {
    it('debería retornar información correcta de los límites', () => {
      const info = getRateLimitInfo();
      
      expect(info).toBeDefined();
      expect(info.general).toBeDefined();
      expect(info.impersonation).toBeDefined();
      expect(info.audit).toBeDefined();

      // Verificar límites generales
      expect(info.general.maxRequests).toBe(10);
      expect(info.general.windowMs).toBe(15 * 60 * 1000); // 15 minutos

      // Verificar límites de impersonación
      expect(info.impersonation.maxRequests).toBe(5);
      expect(info.impersonation.windowMs).toBe(60 * 60 * 1000); // 1 hora

      // Verificar límites de auditoría
      expect(info.audit.maxRequests).toBe(20);
      expect(info.audit.windowMs).toBe(5 * 60 * 1000); // 5 minutos
    });

    it('debería incluir descripciones para cada tipo de límite', () => {
      const info = getRateLimitInfo();
      
      expect(info.general.description).toContain('General admin');
      expect(info.impersonation.description).toContain('impersonation');
      expect(info.audit.description).toContain('Audit');
    });
  });
});