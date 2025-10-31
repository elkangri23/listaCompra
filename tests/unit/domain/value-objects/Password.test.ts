import { Password } from '../../../../src/domain/value-objects/Password';

describe('Password Value Object', () => {
  describe('create', () => {
    it('debería crear una contraseña válida', () => {
      const validPassword = 'SecurePass123!';
      const result = Password.create(validPassword);
      
      expect(result.isSuccess).toBe(true);
    });

    it('debería fallar con contraseña vacía', () => {
      const result = Password.create('');
      
      expect(result.isSuccess).toBe(false);
    });

    it('debería fallar con contraseña solo espacios', () => {
      const result = Password.create('   ');
      
      expect(result.isSuccess).toBe(false);
    });

    it('debería fallar con contraseña muy corta', () => {
      const result = Password.create('123');
      
      expect(result.isSuccess).toBe(false);
    });

    it('debería fallar con contraseña muy larga', () => {
      const longPassword = 'a'.repeat(129);
      const result = Password.create(longPassword);
      
      expect(result.isSuccess).toBe(false);
    });
  });

  describe('toString', () => {
    it('debería devolver [PASSWORD] por seguridad', () => {
      const passwordValue = 'SecurePass123!';
      const password = Password.create(passwordValue);
      
      if (password.isSuccess) {
        expect(password.value.toString()).toBe('[PASSWORD]');
      } else {
        fail('Password creation should have succeeded');
      }
    });

    it('debería permitir acceder al valor real mediante la propiedad value', () => {
      const passwordValue = 'SecurePass123!';
      const password = Password.create(passwordValue);
      
      if (password.isSuccess) {
        expect(password.value.value).toBe(passwordValue);
      } else {
        fail('Password creation should have succeeded');
      }
    });
  });

  describe('equals', () => {
    it('debería ser igual a otra contraseña con el mismo valor', () => {
      const passwordValue = 'SecurePass123!';
      const password1 = Password.create(passwordValue);
      const password2 = Password.create(passwordValue);
      
      if (password1.isSuccess && password2.isSuccess) {
        expect(password1.value.equals(password2.value)).toBe(true);
      } else {
        fail('Password creation should have succeeded');
      }
    });

    it('debería ser diferente a otra contraseña con distinto valor', () => {
      const password1 = Password.create('SecurePass123!');
      const password2 = Password.create('DifferentPass456@');
      
      if (password1.isSuccess && password2.isSuccess) {
        expect(password1.value.equals(password2.value)).toBe(false);
      } else {
        fail('Password creation should have succeeded');
      }
    });
  });

  describe('validation rules', () => {
    it('debería aceptar contraseñas con caracteres especiales', () => {
      const result = Password.create('Password@123');
      expect(result.isSuccess).toBe(true);
    });

    it('debería aceptar contraseñas con números', () => {
      const result = Password.create('Password123');
      expect(result.isSuccess).toBe(true);
    });

    it('debería aceptar contraseñas mixtas', () => {
      const result = Password.create('MySecure123!');
      expect(result.isSuccess).toBe(true);
    });

    it('debería mantener el valor original sin modificaciones', () => {
      const originalValue = 'TestPass123!';
      const result = Password.create(originalValue);
      
      if (result.isSuccess) {
        expect(result.value.value).toBe(originalValue);
      } else {
        fail('Password creation should have succeeded');
      }
    });

    it('debería funcionar con contraseñas en el límite mínimo', () => {
      const minPassword = 'Pass123!'; // 8 caracteres
      const result = Password.create(minPassword);
      expect(result.isSuccess).toBe(true);
    });

    it('debería funcionar con contraseñas en el límite máximo', () => {
      const maxPassword = 'A1a!' + 'a'.repeat(124); // 128 caracteres total
      const result = Password.create(maxPassword);
      expect(result.isSuccess).toBe(true);
    });
  });
});