import { Email } from '../../../../src/domain/value-objects/Email';
import { InvalidEmailError } from '../../../../src/domain/errors/InvalidEmailError';

describe('Email', () => {
  describe('create', () => {
    it('debería crear un email válido exitosamente', () => {
      const email = 'test@example.com';
      const result = Email.create(email);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.value).toBe(email);
        expect(result.value.toString()).toBe(email);
      }
    });

    it('debería normalizar el email correctamente', () => {
      const email = '  TEST@EXAMPLE.COM  ';
      const result = Email.create(email);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.value).toBe('test@example.com');
      }
    });

    it('debería fallar con email vacío', () => {
      const result = Email.create('');

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidEmailError);
      }
    });

    it('debería fallar con email null', () => {
      const result = Email.create(null as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidEmailError);
      }
    });

    it('debería fallar con email undefined', () => {
      const result = Email.create(undefined as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidEmailError);
      }
    });

    it('debería fallar con formato de email inválido', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test@@example.com',
        'test.example.com',
        'test@example',
        'test @example.com',
        'test@exam ple.com'
      ];

      invalidEmails.forEach(email => {
        const result = Email.create(email);
        expect(result.isSuccess).toBe(false);
        if (!result.isSuccess) {
          expect(result.error).toBeInstanceOf(InvalidEmailError);
        }
      });
    });

    it('debería fallar con email demasiado largo', () => {
      // Crear un email que supere los 254 caracteres
      const longLocalPart = 'a'.repeat(250);
      const longEmail = `${longLocalPart}@example.com`; // Más de 254 caracteres
      const result = Email.create(longEmail);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidEmailError);
      }
    });

    it('debería aceptar emails válidos comunes', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'test123@test-domain.com',
        'user_name@example-domain.net'
      ];

      validEmails.forEach(email => {
        const result = Email.create(email);
        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          expect(result.value.value).toBe(email.toLowerCase());
        }
      });
    });
  });

  describe('createUnsafe', () => {
    it('debería crear un email válido sin Result wrapper', () => {
      const email = 'test@example.com';
      const emailObj = Email.createUnsafe(email);

      expect(emailObj.value).toBe(email);
      expect(emailObj.toString()).toBe(email);
    });

    it('debería lanzar excepción con email inválido', () => {
      expect(() => {
        Email.createUnsafe('invalid-email');
      }).toThrow(InvalidEmailError);
    });
  });

  describe('utility methods', () => {
    it('debería obtener el dominio correctamente', () => {
      const email = Email.createUnsafe('user@example.com');
      
      expect(email.getDomain()).toBe('example.com');
    });

    it('debería obtener la parte local correctamente', () => {
      const email = Email.createUnsafe('user@example.com');
      
      expect(email.getLocalPart()).toBe('user');
    });

    it('debería verificar si pertenece a un dominio específico', () => {
      const email = Email.createUnsafe('user@example.com');
      
      expect(email.isFromDomain('example.com')).toBe(true);
      expect(email.isFromDomain('EXAMPLE.COM')).toBe(true);
      expect(email.isFromDomain('other.com')).toBe(false);
    });

    it('debería manejar emails complejos en métodos de utilidad', () => {
      const email = Email.createUnsafe('user.name+tag@sub.example.co.uk');
      
      expect(email.getDomain()).toBe('sub.example.co.uk');
      expect(email.getLocalPart()).toBe('user.name+tag');
      expect(email.isFromDomain('sub.example.co.uk')).toBe(true);
    });

    it('debería verificar igualdad de emails', () => {
      const email1 = Email.createUnsafe('test@example.com');
      const email2 = Email.createUnsafe('test@example.com');
      const email3 = Email.createUnsafe('other@example.com');

      expect(email1.equals(email2)).toBe(true);
      expect(email1.equals(email3)).toBe(false);
    });

    it('debería convertir a JSON correctamente', () => {
      const email = Email.createUnsafe('test@example.com');
      
      expect(email.toJSON()).toBe('test@example.com');
    });
  });

  describe('edge cases', () => {
    it('debería manejar emails con caracteres especiales válidos', () => {
      const specialEmails = [
        'user+tag@example.com',
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com'
      ];

      specialEmails.forEach(email => {
        const result = Email.create(email);
        expect(result.isSuccess).toBe(true);
      });
    });

    it('debería manejar dominios complejos', () => {
      const complexDomains = [
        'user@sub.domain.com',
        'user@test-domain.co.uk'
      ];

      complexDomains.forEach(email => {
        const result = Email.create(email);
        expect(result.isSuccess).toBe(true);
      });
    });

    it('debería manejar casos límite de longitud', () => {
      // Email en el límite máximo
      const localPart = 'a'.repeat(64); // Máximo para parte local
      const domain = 'b'.repeat(60) + '.com'; // Total cerca del límite
      const borderlineEmail = `${localPart}@${domain}`;
      
      const result = Email.create(borderlineEmail);
      expect(result.isSuccess).toBe(true);
    });
  });
});