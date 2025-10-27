/**
 * Contenedor de inyección de dependencias
 * Compone e inyecta todas las dependencias de la aplicación
 */

import { PrismaClient } from '@prisma/client';

// Application Use Cases
import { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import { CreateList } from '@application/use-cases/lists/CreateList';
import { GetUserLists } from '@application/use-cases/lists/GetUserLists';
import { UpdateList } from '@application/use-cases/lists/UpdateList';
import { DeleteList } from '@application/use-cases/lists/DeleteList';
import { AddProduct } from '@application/use-cases/products/AddProduct';
import { UpdateProduct } from '@application/use-cases/products/UpdateProduct';
import { MarkProductAsPurchased } from '@application/use-cases/products/MarkProductAsPurchased';
import { DeleteProduct } from '@application/use-cases/products/DeleteProduct';
import { GetProducts } from '@application/use-cases/products/GetProducts';

// Infrastructure Adapters
import { PrismaUsuarioRepository } from '@infrastructure/persistence/repositories/PrismaUsuarioRepository';
import { PrismaListaRepository } from '@infrastructure/persistence/repositories/PrismaListaRepository';
import { PrismaProductoRepository } from '@infrastructure/persistence/repositories/PrismaProductoRepository';
import { BcryptPasswordHasher } from '@infrastructure/external-services/auth/BcryptPasswordHasher';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { RabbitMQEventPublisher } from '@infrastructure/messaging/RabbitMQEventPublisher';

// HTTP Layer
import { AuthController } from '@infrastructure/http/controllers/AuthController';
import { ListController } from '@infrastructure/http/controllers/ListController';
import { ProductController } from '@infrastructure/http/controllers/ProductController';

// Interfaces
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';

export class Container {
  private static instance: Container;
  private _prisma!: PrismaClient;

  // Repositories
  private _usuarioRepository!: IUsuarioRepository;
  private _listaRepository!: IListaRepository;
  private _productoRepository!: IProductoRepository;

  // External Services
  private _passwordHasher!: IPasswordHasher;
  private _tokenService!: ITokenService;
  private _eventPublisher!: IEventPublisher;

  // Use Cases
  private _registerUser!: RegisterUser;
  private _authenticateUser!: AuthenticateUser;
  private _createList!: CreateList;
  private _getUserLists!: GetUserLists;
  private _updateList!: UpdateList;
  private _deleteList!: DeleteList;
  private _addProduct!: AddProduct;
  private _updateProduct!: UpdateProduct;
  private _markProductAsPurchased!: MarkProductAsPurchased;
  private _deleteProduct!: DeleteProduct;
  private _getProducts!: GetProducts;

  // Controllers
  private _authController!: AuthController;
  private _listController!: ListController;
  private _productController!: ProductController;

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

  /**
   * Inicializa la conexión RabbitMQ si está habilitado
   */
  public async initializeRabbitMQ(): Promise<void> {
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    
    if (rabbitmqEnabled && this._eventPublisher instanceof RabbitMQEventPublisher) {
      try {
        await this._eventPublisher.initialize();
        console.log('✅ RabbitMQ inicializado correctamente');
      } catch (error) {
        console.error('❌ Error al inicializar RabbitMQ:', error);
        // Fallback a un publisher que no haga nada
        this._eventPublisher = {
          publish: async (exchange: string, routingKey: string, _message: any) => {
            console.log(`📝 EventPublisher fallback - ${exchange} -> ${routingKey}`);
          }
        };
        console.log('🔄 Usando EventPublisher fallback por error de conexión');
      }
    }
  }

  /**
   * Cierra las conexiones del container
   */
  public async close(): Promise<void> {
    if (this._eventPublisher instanceof RabbitMQEventPublisher) {
      await this._eventPublisher.close();
    }
    
    await this._prisma.$disconnect();
    console.log('✅ Container cerrado correctamente');
  }

  private initializeInfrastructure(): void {
    this._prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  private initializeRepositories(): void {
    this._usuarioRepository = new PrismaUsuarioRepository(this._prisma);
    this._listaRepository = new PrismaListaRepository(this._prisma);
    this._productoRepository = new PrismaProductoRepository(this._prisma);
  }

  private initializeExternalServices(): void {
    this._passwordHasher = new BcryptPasswordHasher();
    this._tokenService = new JWTTokenService();
    
    // Configurar EventPublisher según variables de entorno
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    // TODO: Usar rabbitmqUrl cuando implementemos la conexión real
    // const rabbitmqUrl = process.env['RABBITMQ_URL'] || 'amqp://guest:guest@localhost:5672';
    
    if (rabbitmqEnabled) {
      this._eventPublisher = new RabbitMQEventPublisher();
      console.log('� Usando RabbitMQEventPublisher - RabbitMQ habilitado');
    } else {
      // Crear un EventPublisher que no haga nada si está deshabilitado
      this._eventPublisher = {
        publish: async (exchange: string, routingKey: string, _message: any) => {
          console.log(`📝 EventPublisher deshabilitado - ${exchange} -> ${routingKey}`);
        }
      };
      console.log('🔄 EventPublisher deshabilitado');
    }
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

    // Lista use cases
    this._createList = new CreateList(
      this._listaRepository
    );

    this._getUserLists = new GetUserLists(
      this._listaRepository
    );

    this._updateList = new UpdateList(
      this._listaRepository
    );

    this._deleteList = new DeleteList(
      this._listaRepository
    );

    // Product use cases
    this._addProduct = new AddProduct(
      this._productoRepository,
      this._listaRepository
    );

    this._updateProduct = new UpdateProduct(
      this._productoRepository
    );

    this._markProductAsPurchased = new MarkProductAsPurchased(
      this._productoRepository
    );

    this._deleteProduct = new DeleteProduct(
      this._productoRepository
    );

    this._getProducts = new GetProducts(
      this._productoRepository,
      this._listaRepository
    );
  }

  private initializeControllers(): void {
    this._authController = new AuthController({
      registerUser: this._registerUser,
      authenticateUser: this._authenticateUser,
    });

    this._listController = new ListController(
      this._createList,
      this._getUserLists,
      this._updateList,
      this._deleteList
    );

    this._productController = new ProductController(
      this._addProduct,
      this._updateProduct,
      this._markProductAsPurchased,
      this._deleteProduct,
      this._getProducts
    );
  }

  // Getters para acceder a las dependencias

  public get prisma(): PrismaClient {
    return this._prisma;
  }

  public get usuarioRepository(): IUsuarioRepository {
    return this._usuarioRepository;
  }

  public get listaRepository(): IListaRepository {
    return this._listaRepository;
  }

  public get passwordHasher(): IPasswordHasher {
    return this._passwordHasher;
  }

  public get tokenService(): ITokenService {
    return this._tokenService;
  }

  public get eventPublisher(): IEventPublisher {
    return this._eventPublisher;
  }

  public get registerUser(): RegisterUser {
    return this._registerUser;
  }

  public get authenticateUser(): AuthenticateUser {
    return this._authenticateUser;
  }

  public get createList(): CreateList {
    return this._createList;
  }

  public get getUserLists(): GetUserLists {
    return this._getUserLists;
  }

  public get updateList(): UpdateList {
    return this._updateList;
  }

  public get deleteList(): DeleteList {
    return this._deleteList;
  }

  public get addProduct(): AddProduct {
    return this._addProduct;
  }

  public get updateProduct(): UpdateProduct {
    return this._updateProduct;
  }

  public get markProductAsPurchased(): MarkProductAsPurchased {
    return this._markProductAsPurchased;
  }

  public get deleteProduct(): DeleteProduct {
    return this._deleteProduct;
  }

  public get getProducts(): GetProducts {
    return this._getProducts;
  }

  public get authController(): AuthController {
    return this._authController;
  }

  public get listController(): ListController {
    return this._listController;
  }

  public get productController(): ProductController {
    return this._productController;
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