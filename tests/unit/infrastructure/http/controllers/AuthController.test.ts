import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../../../src/infrastructure/http/controllers/AuthController';
import type { RegisterUser } from '../../../../../src/application/use-cases/auth/RegisterUser';
import type { AuthenticateUser } from '../../../../../src/application/use-cases/auth/AuthenticateUser';
import { success, failure } from '../../../../../src/shared/result';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';

describe('AuthController', () => {
  let authController: AuthController;
  let registerUser: jest.Mocked<RegisterUser>;
  let authenticateUser: jest.Mocked<AuthenticateUser>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    registerUser = {
      execute: jest.fn()
    } as any;

    authenticateUser = {
      execute: jest.fn()
    } as any;

    authController = new AuthController({
      registerUser,
      authenticateUser
    });

    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('register', () => {
    it('debería registrar un usuario exitosamente', async () => {
      // Arrange
      req.body = {
        nombre: 'Juan',
        apellidos: 'Pérez',
        email: 'juan@example.com',
        password: 'SecurePass123!',
        aceptoTerminos: true
      };

      const mockResponse = {
        id: 'user-id',
        nombre: 'Juan',
        apellidos: 'Pérez',
        email: 'juan@example.com',
        nombreCompleto: 'Juan Pérez',
        rol: 'USUARIO',
        activo: true,
        emailVerificado: false,
        fechaCreacion: new Date().toISOString()
      };

      registerUser.execute.mockResolvedValue(success(mockResponse));

      // Act
      await authController.register(req as Request, res as Response, next);

      // Assert
      expect(registerUser.execute).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            user: expect.objectContaining({
              id: mockResponse.id,
              email: mockResponse.email,
              nombre: mockResponse.nombre
            })
          },
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('debería manejar errores de validación en registro', async () => {
      // Arrange
      req.body = {
        nombre: '',
        email: 'invalid-email',
        password: '123'
      };

      registerUser.execute.mockResolvedValue(failure(new Error('Validation error')));

      // Act
      await authController.register(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'VALIDATION_ERROR',
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('debería manejar errores internos del servidor', async () => {
      // Arrange
      req.body = {
        nombre: 'Juan',
        email: 'juan@example.com',
        password: 'SecurePass123!'
      };

      registerUser.execute.mockRejectedValue(new Error('Internal error'));

      // Act
      await authController.register(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    it('debería autenticar un usuario exitosamente', async () => {
      // Arrange
      req.body = {
        email: 'juan@example.com',
        password: 'SecurePass123!'
      };

      const mockResponse = {
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        },
        user: {
          id: 'user-id',
          nombre: 'Juan',
          apellidos: 'Pérez',
          email: 'juan@example.com',
          nombreCompleto: 'Juan Pérez',
          rol: 'USUARIO',
          activo: true,
          emailVerificado: true
        }
      };

      authenticateUser.execute.mockResolvedValue(success(mockResponse));

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(authenticateUser.execute).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.any(Object),
            tokens: expect.any(Object)
          }),
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('debería rechazar credenciales incorrectas', async () => {
      // Arrange
      req.body = {
        email: 'juan@example.com',
        password: 'wrongpassword'
      };

      const { UnauthorizedError } = require('../../../../../src/application/errors/UnauthorizedError');
      authenticateUser.execute.mockResolvedValue(failure(new UnauthorizedError('Invalid credentials')));

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'UNAUTHORIZED',
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('debería devolver emailNotVerified en 200 cuando la cuenta no está verificada', async () => {
      // Arrange
      req.body = {
        email: 'juan@example.com',
        password: 'miPassword123',
      };

      authenticateUser.execute.mockResolvedValue(
        failure(new UnauthorizedError('Email no verificado'))
      );

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            emailNotVerified: true,
            email: 'juan@example.com',
          }),
        })
      );
    });

    it('debería manejar datos de entrada inválidos', async () => {
      // Arrange
      req.body = {
        email: 'invalid-email',
        password: ''
      };

      authenticateUser.execute.mockResolvedValue(failure(new Error('Validation error')));

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'VALIDATION_ERROR',
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('debería llamar next cuando hay una excepción no controlada', async () => {
      // Arrange
      req.body = { email: 'test@example.com', password: 'test' };
      authenticateUser.execute.mockRejectedValue(new Error('Unexpected error'));

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
describe('AuthController (GDPR, item 15)', () => {
  let authController: AuthController;
  let requestAccountDeletion: any;
  let exportMyData: any;
  let verifyEmailCode: any;
  let requestEmailVerificationCode: any;
  let requestPasswordResetCode: any;
  let resetPasswordWithCode: any;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    requestAccountDeletion = { execute: jest.fn() };
    exportMyData = { execute: jest.fn() };
    verifyEmailCode = { execute: jest.fn() };
    requestEmailVerificationCode = { execute: jest.fn() };
    requestPasswordResetCode = { execute: jest.fn() };
    resetPasswordWithCode = { execute: jest.fn() };

    authController = new AuthController({
      registerUser: {} as any,
      authenticateUser: {} as any,
      requestAccountDeletion,
      exportMyData,
      verifyEmailCode,
      requestEmailVerificationCode,
      requestPasswordResetCode,
      resetPasswordWithCode,
    });

    req = {
      body: {},
      user: { userId: 'user-1' },
    } as any;

    res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('requestDeletion', () => {
    it('solicita la eliminación y devuelve la fecha definitiva', async () => {
      req.body = { password: 'SecurePass123!' };
      requestAccountDeletion.execute.mockResolvedValue(
        success({
          mensaje: 'Cuenta desactivada',
          eliminacionSolicitadaEn: '2026-11-26T00:00:00.000Z',
          eliminacionDefinitivaEn: '2026-12-26T00:00:00.000Z',
        })
      );

      await authController.requestDeletion(req as Request, res as Response, next);

      expect(requestAccountDeletion.execute).toHaveBeenCalledWith({
        usuarioId: 'user-1',
        password: 'SecurePass123!',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ eliminacionDefinitivaEn: '2026-12-26T00:00:00.000Z' })
      );
    });

    it('devuelve 401 sin usuario autenticado', async () => {
      (req as any).user = undefined;

      await authController.requestDeletion(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(requestAccountDeletion.execute).not.toHaveBeenCalled();
    });

    it('devuelve 401 con la contraseña incorrecta', async () => {
      req.body = { password: 'ClaveMala123!' };
      requestAccountDeletion.execute.mockResolvedValue(
        failure(new UnauthorizedError('La contraseña actual no es correcta'))
      );

      await authController.requestDeletion(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('exportMyData', () => {
    it('exporta los datos como archivo JSON descargable', async () => {
      exportMyData.execute.mockResolvedValue(
        success({ exportadoEn: '2026-11-26T00:00:00.000Z', usuario: { email: 'a@example.com' } })
      );

      await authController.exportMyData(req as Request, res as Response, next);

      expect(exportMyData.execute).toHaveBeenCalledWith({ usuarioId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.set).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('mis-datos-lista-compra-')
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ exportadoEn: '2026-11-26T00:00:00.000Z' })
      );
    });

    it('devuelve 401 sin usuario autenticado', async () => {
      (req as any).user = undefined;

      await authController.exportMyData(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(exportMyData.execute).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('verifica el correo y devuelve 200', async () => {
      req.body = { email: 'juan@example.com', codigo: '482913' };
      verifyEmailCode.execute.mockResolvedValue(
        success({
          emailVerificado: true,
          mensaje: 'Tu correo ha sido verificado. Ya puedes entrar.',
        })
      );

      await authController.verifyEmail(req as Request, res as Response, next);

      expect(verifyEmailCode.execute).toHaveBeenCalledWith({
        email: 'juan@example.com',
        codigo: '482913',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ emailVerificado: true }),
        })
      );
    });

    it('devuelve 400 sin email o sin código', async () => {
      req.body = { email: 'juan@example.com' };

      await authController.verifyEmail(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(verifyEmailCode.execute).not.toHaveBeenCalled();
    });

    it('devuelve 401 con un código incorrecto', async () => {
      req.body = { email: 'juan@example.com', codigo: '111111' };
      verifyEmailCode.execute.mockResolvedValue(
        failure(new UnauthorizedError('El código no es válido o ha caducado.'))
      );

      await authController.verifyEmail(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('resendVerificationCode', () => {
    it('reenvía el código y devuelve 200', async () => {
      req.body = { email: 'juan@example.com' };
      requestEmailVerificationCode.execute.mockResolvedValue(
        success({
          emailSent: true,
          mensaje: 'Te hemos enviado un código de 6 dígitos a tu correo.',
        })
      );

      await authController.resendVerificationCode(req as Request, res as Response, next);

      expect(requestEmailVerificationCode.execute).toHaveBeenCalledWith({
        email: 'juan@example.com',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ emailSent: true }),
        })
      );
    });

    it('devuelve 400 sin email', async () => {
      req.body = {};

      await authController.resendVerificationCode(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(requestEmailVerificationCode.execute).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('solicita el código y devuelve 200', async () => {
      req.body = { email: 'juan@example.com' };
      requestPasswordResetCode.execute.mockResolvedValue(
        success({
          emailSent: true,
          mensaje: 'Te hemos enviado un código de 6 dígitos a tu correo.',
        })
      );

      await authController.requestPasswordReset(req as Request, res as Response, next);

      expect(requestPasswordResetCode.execute).toHaveBeenCalledWith({
        email: 'juan@example.com',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ emailSent: true }),
        })
      );
    });

    it('devuelve 400 sin email', async () => {
      req.body = {};

      await authController.requestPasswordReset(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(requestPasswordResetCode.execute).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('restablece la contraseña y devuelve 200', async () => {
      req.body = { email: 'juan@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' };
      resetPasswordWithCode.execute.mockResolvedValue(
        success({
          mensaje: 'Tu contraseña ha sido cambiada. Ya puedes entrar con la nueva.',
        })
      );

      await authController.resetPassword(req as Request, res as Response, next);

      expect(resetPasswordWithCode.execute).toHaveBeenCalledWith({
        email: 'juan@example.com',
        codigo: '482913',
        nuevaPassword: 'NuevaPass123!',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('devuelve 400 sin algún campo', async () => {
      req.body = { email: 'juan@example.com', codigo: '482913' };

      await authController.resetPassword(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(resetPasswordWithCode.execute).not.toHaveBeenCalled();
    });

    it('devuelve 401 con un código incorrecto', async () => {
      req.body = { email: 'juan@example.com', codigo: '111111', nuevaPassword: 'NuevaPass123!' };
      resetPasswordWithCode.execute.mockResolvedValue(
        failure(new UnauthorizedError('El código no es válido o ha caducado.'))
      );

      await authController.resetPassword(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
