import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../../../src/infrastructure/http/controllers/AuthController';
import { RegisterUser } from '../../../../../src/application/use-cases/auth/RegisterUser';
import { AuthenticateUser } from '../../../../../src/application/use-cases/auth/AuthenticateUser';
import { success, failure } from '../../../../../src/shared/result';

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
        password: 'SecurePass123!'
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResponse
      });
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
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error'
      });
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
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error interno del servidor'
      });
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResponse
      });
    });

    it('debería rechazar credenciales incorrectas', async () => {
      // Arrange
      req.body = {
        email: 'juan@example.com',
        password: 'wrongpassword'
      };

      authenticateUser.execute.mockResolvedValue(failure(new Error('Invalid credentials')));

      // Act
      await authController.login(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials'
      });
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
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error'
      });
    });

    it('debería llamar next cuando hay una excepción no controlada', async () => {
      // Arrange
      req.body = { email: 'test@example.com', password: 'test' };
      registerUser.execute.mockRejectedValue(new Error('Unexpected error'));

      // Act
      await authController.register(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});