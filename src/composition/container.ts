/**
 * Contenedor de inyección de dependencias
 * Compone e inyecta todas las dependencias de la aplicación
 */

import { PrismaClient } from '@prisma/client';

// Application Use Cases
import { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';

// Infrastructure Adapters
import { PrismaUsuarioRepository } from '@infrastructure/persistence/repositories/PrismaUsuarioRepository';
import { BcryptPasswordHasher } from '@infrastructure/external-services/auth/BcryptPasswordHasher';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';

// HTTP Layer
import { AuthController } from '@infrastructure/http/controllers/AuthController';

// Interfaces
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { ITokenService } from '@application/ports/auth/ITokenService';

export class Container {
  private static instance: Container;
  private _prisma!: PrismaClient;

  // Repositories
  private _usuarioRepository!: IUsuarioRepository;

  // External Services
  private _passwordHasher!: IPasswordHasher;
  private _tokenService!: ITokenService;

  // Use Cases
  private _registerUser!: RegisterUser;
  private _authenticateUser!: AuthenticateUser;

  // Controllers
  private _authController!: AuthController;

  private constructor() {
    this.initializeInfrastructure();
    this.initializeRepositories();
    this.initializeExternalServices();
    this.initializeUseCases();
    this.initializeControllers();
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  private initializeInfrastructure(): void {
    this._prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  private initializeRepositories(): void {
    this._usuarioRepository = new PrismaUsuarioRepository(this._prisma);
  }

  private initializeExternalServices(): void {
    this._passwordHasher = new BcryptPasswordHasher();
    this._tokenService = new JWTTokenService();
  }

  private initializeUseCases(): void {
    this._registerUser = new RegisterUser(
      this._usuarioRepository,
      this._passwordHasher
    );

    this._authenticateUser = new AuthenticateUser(
      this._usuarioRepository,
      this._passwordHasher,
      this._tokenService
    );
  }

  private initializeControllers(): void {
    this._authController = new AuthController({
      registerUser: this._registerUser,
      authenticateUser: this._authenticateUser,
    });
  }

  // Getters para acceder a las dependencias

  public get prisma(): PrismaClient {
    return this._prisma;
  }

  public get usuarioRepository(): IUsuarioRepository {
    return this._usuarioRepository;
  }

  public get passwordHasher(): IPasswordHasher {
    return this._passwordHasher;
  }

  public get tokenService(): ITokenService {
    return this._tokenService;
  }

  public get registerUser(): RegisterUser {
    return this._registerUser;
  }

  public get authenticateUser(): AuthenticateUser {
    return this._authenticateUser;
  }

  public get authController(): AuthController {
    return this._authController;
  }

  /**
   * Conecta a la base de datos
   */
  public async connect(): Promise<void> {
    try {
      await this._prisma.$connect();
      console.log('✅ Base de datos conectada');
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error);
      throw error;
    }
  }

  /**
   * Desconecta de la base de datos
   */
  public async disconnect(): Promise<void> {
    try {
      await this._prisma.$disconnect();
      console.log('✅ Base de datos desconectada');
    } catch (error) {
      console.error('❌ Error desconectando de la base de datos:', error);
      throw error;
    }
  }

  /**
   * Comprueba el estado de la conexión a la base de datos
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this._prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Health check de base de datos falló:', error);
      return false;
    }
  }
}