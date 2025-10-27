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
import { CreateCategory } from '@application/use-cases/categories/CreateCategory';
import { GetCategoriesByStore } from '@application/use-cases/categories/GetCategoriesByStore';
import { UpdateCategory } from '@application/use-cases/categories/UpdateCategory';
import { DeleteCategory } from '@application/use-cases/categories/DeleteCategory';
import { CreateStore } from '@application/use-cases/stores/CreateStore';
import { GetStores } from '@application/use-cases/stores/GetStores';
import { UpdateStore } from '@application/use-cases/stores/UpdateStore';
import { DeleteStore } from '@application/use-cases/stores/DeleteStore';
// import { ShareList } from '@application/use-cases/invitations/ShareList';
// import { AccessSharedList } from '@application/use-cases/invitations/AccessSharedList';
// import { ManagePermissions } from '@application/use-cases/invitations/ManagePermissions';
// import { CancelInvitation } from '@application/use-cases/invitations/CancelInvitation';

// Infrastructure Adapters
import { PrismaUsuarioRepository } from '@infrastructure/persistence/repositories/PrismaUsuarioRepository';
import { PrismaListaRepository } from '@infrastructure/persistence/repositories/PrismaListaRepository';
import { PrismaProductoRepository } from '@infrastructure/persistence/repositories/PrismaProductoRepository';
import { PrismaCategoriaRepository } from '@infrastructure/persistence/repositories/PrismaCategoriaRepository';
import { PrismaTiendaRepository } from '@infrastructure/persistence/repositories/PrismaTiendaRepository';
// import { PrismaInvitacionRepository } from '@infrastructure/persistence/repositories/PrismaInvitacionRepository';
// import { PrismaPermisoRepository } from '@infrastructure/persistence/repositories/PrismaPermisoRepository';
import { BcryptPasswordHasher } from '@infrastructure/external-services/auth/BcryptPasswordHasher';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { RabbitMQEventPublisher } from '@infrastructure/messaging/RabbitMQEventPublisher';
// import { PrismaOutboxService } from '@infrastructure/messaging/PrismaOutboxService';
// import { InvitationHashGenerator } from '@domain/services/InvitationHashGenerator';

// HTTP Layer
import { AuthController } from '@infrastructure/http/controllers/AuthController';
import { ListController } from '@infrastructure/http/controllers/ListController';
import { ProductController } from '@infrastructure/http/controllers/ProductController';
import { CategoryController } from '@infrastructure/http/controllers/CategoryController';
import { StoreController } from '@infrastructure/http/controllers/StoreController';
// import { InvitationController } from '@infrastructure/http/controllers/InvitationController';

// Interfaces
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
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
  private _categoriaRepository!: ICategoriaRepository;
  private _tiendaRepository!: ITiendaRepository;

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
  private _createCategory!: CreateCategory;
  private _getCategoriesByStore!: GetCategoriesByStore;
  private _updateCategory!: UpdateCategory;
  private _deleteCategory!: DeleteCategory;
  private _createStore!: CreateStore;
  private _getStores!: GetStores;
  private _updateStore!: UpdateStore;
  private _deleteStore!: DeleteStore;

  // Controllers
  private _authController!: AuthController;
  private _listController!: ListController;
  private _productController!: ProductController;
  private _categoryController!: CategoryController;
  private _storeController!: StoreController;

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
          publish: async (event: any) => {
            console.log(`📝 EventPublisher fallback - ${event.eventType} (${event.eventId})`);
            return { isSuccess: true, isFailure: false, value: undefined, error: null };
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
    this._categoriaRepository = new PrismaCategoriaRepository(this._prisma);
    this._tiendaRepository = new PrismaTiendaRepository(this._prisma);
  }

  private initializeExternalServices(): void {
    this._passwordHasher = new BcryptPasswordHasher();
    this._tokenService = new JWTTokenService();
    
    // Configurar EventPublisher según variables de entorno
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    const rabbitmqUrl = process.env['RABBITMQ_URL'] || 'amqp://guest:guest@localhost:5672';
    
    if (rabbitmqEnabled) {
      this._eventPublisher = new RabbitMQEventPublisher(rabbitmqUrl);
      console.log('📡 Usando RabbitMQEventPublisher - RabbitMQ habilitado');
    } else {
      // Crear un EventPublisher que no haga nada si está deshabilitado
      this._eventPublisher = {
        publish: async (event: any) => {
          console.log(`📝 EventPublisher deshabilitado - ${event.eventType} (${event.eventId})`);
          return { isSuccess: true, isFailure: false, value: undefined, error: null };
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

    // Category use cases
    this._createCategory = new CreateCategory(
      this._categoriaRepository,
      this._tiendaRepository
    );

    this._getCategoriesByStore = new GetCategoriesByStore(
      this._categoriaRepository,
      this._tiendaRepository
    );

    this._updateCategory = new UpdateCategory(
      this._categoriaRepository,
      this._tiendaRepository
    );

    this._deleteCategory = new DeleteCategory(
      this._categoriaRepository,
      this._productoRepository
    );

    // Store use cases
    this._createStore = new CreateStore(
      this._tiendaRepository
    );

    this._getStores = new GetStores(
      this._tiendaRepository
    );

    this._updateStore = new UpdateStore(
      this._tiendaRepository
    );

    this._deleteStore = new DeleteStore(
      this._tiendaRepository
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

    this._categoryController = new CategoryController(
      this._createCategory,
      this._getCategoriesByStore,
      this._updateCategory,
      this._deleteCategory
    );

    this._storeController = new StoreController(
      this._createStore,
      this._getStores,
      this._updateStore,
      this._deleteStore
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

  public get categoriaRepository(): ICategoriaRepository {
    return this._categoriaRepository;
  }

  public get tiendaRepository(): ITiendaRepository {
    return this._tiendaRepository;
  }

  public get createCategory(): CreateCategory {
    return this._createCategory;
  }

  public get getCategoriesByStore(): GetCategoriesByStore {
    return this._getCategoriesByStore;
  }

  public get updateCategory(): UpdateCategory {
    return this._updateCategory;
  }

  public get deleteCategory(): DeleteCategory {
    return this._deleteCategory;
  }

  public get createStore(): CreateStore {
    return this._createStore;
  }

  public get getStores(): GetStores {
    return this._getStores;
  }

  public get updateStore(): UpdateStore {
    return this._updateStore;
  }

  public get deleteStore(): DeleteStore {
    return this._deleteStore;
  }

  public get categoryController(): CategoryController {
    return this._categoryController;
  }

  public get storeController(): StoreController {
    return this._storeController;
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