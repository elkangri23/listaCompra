/**
 * Contenedor de inyección de dependencias
 * Compone e inyecta todas las dependencias de la aplicación
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { success } from '@shared/result';

// Application Use Cases
import { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import { CreateList } from '@application/use-cases/lists/CreateList';
import { GetUserLists } from '@application/use-cases/lists/GetUserLists';
import { UpdateList } from '@application/use-cases/lists/UpdateList';
import { DeleteList } from '@application/use-cases/lists/DeleteList';
import { GetListById } from '@application/use-cases/lists/GetListById';
import { AddProduct } from '@application/use-cases/products/AddProduct';
import { UpdateProduct } from '@application/use-cases/products/UpdateProduct';
import { MarkProductAsPurchased } from '@application/use-cases/products/MarkProductAsPurchased';
import { DeleteProduct } from '@application/use-cases/products/DeleteProduct';
import { GetProducts } from '@application/use-cases/products/GetProducts';
import { GetProductRecommendations } from '@application/use-cases/products/GetProductRecommendations';
import { CreateCategory } from '@application/use-cases/categories/CreateCategory';
import { GetCategoriesByStore } from '@application/use-cases/categories/GetCategoriesByStore';
import { UpdateCategory } from '@application/use-cases/categories/UpdateCategory';
import { DeleteCategory } from '@application/use-cases/categories/DeleteCategory';
import { CreateStore } from '@application/use-cases/stores/CreateStore';
import { GetStores } from '@application/use-cases/stores/GetStores';
import { UpdateStore } from '@application/use-cases/stores/UpdateStore';
import { DeleteStore } from '@application/use-cases/stores/DeleteStore';
import { ShareList } from '@application/use-cases/invitations/ShareList';
import { AccessSharedList } from '@application/use-cases/invitations/AccessSharedList';
import { ManagePermissions } from '@application/use-cases/invitations/ManagePermissions';
import { CancelInvitation } from '@application/use-cases/invitations/CancelInvitation';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { BulkCategorizeProducts } from '@application/use-cases/ai/BulkCategorizeProducts';
import { GetCollaborativeDashboard } from '@application/use-cases/analytics/GetCollaborativeDashboard';

// Infrastructure Adapters
import { PrismaUsuarioRepository } from '@infrastructure/persistence/repositories/PrismaUsuarioRepository';
import { PrismaListaRepository } from '@infrastructure/persistence/repositories/PrismaListaRepository';
import { PrismaProductoRepository } from '@infrastructure/persistence/repositories/PrismaProductoRepository';
import { PrismaCategoriaRepository } from '@infrastructure/persistence/repositories/PrismaCategoriaRepository';
import { PrismaTiendaRepository } from '@infrastructure/persistence/repositories/PrismaTiendaRepository';
import { PrismaInvitacionRepository } from '@infrastructure/persistence/repositories/PrismaInvitacionRepository';
import { PrismaPermisoRepository } from '@infrastructure/persistence/repositories/PrismaPermisoRepository';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryListaRepository } from '@infrastructure/persistence/in-memory/InMemoryListaRepository';
import { InMemoryProductoRepository } from '@infrastructure/persistence/in-memory/InMemoryProductoRepository';
import { InMemoryCategoriaRepository } from '@infrastructure/persistence/in-memory/InMemoryCategoriaRepository';
import { InMemoryTiendaRepository } from '@infrastructure/persistence/in-memory/InMemoryTiendaRepository';
import { InMemoryInvitacionRepository } from '@infrastructure/persistence/in-memory/InMemoryInvitacionRepository';
import { InMemoryPermisoRepository } from '@infrastructure/persistence/in-memory/InMemoryPermisoRepository';
import { BcryptPasswordHasher } from '@infrastructure/external-services/auth/BcryptPasswordHasher';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { RabbitMQEventPublisher } from '@infrastructure/messaging/RabbitMQEventPublisher';
import { PrismaOutboxService } from '@infrastructure/messaging/outbox/PrismaOutboxService';
import { OutboxWorker } from '@infrastructure/messaging/outbox/OutboxWorker';
import { InvitationHashGenerator } from '@domain/services/InvitationHashGenerator';
import { NodemailerService } from '@infrastructure/external-services/email/NodemailerService';
import { PerplexityConfig } from '@infrastructure/config/ai.config';
import { WorkerService } from '@infrastructure/messaging/WorkerService';
import { InMemoryOutboxService } from '@infrastructure/messaging/outbox/InMemoryOutboxService';
import { PrismaAnalyticsRepository } from '@infrastructure/persistence/repositories/PrismaAnalyticsRepository';
import { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { MetricsCollector } from '@infrastructure/observability/metrics/MetricsCollector';
import getRedisConfig, { RedisConfig } from '@infrastructure/config/redis.config';
import { CachedAIService } from '@infrastructure/external-services/ai/CachedAIService';
import type { CachedAIServiceDependencies } from '@infrastructure/external-services/ai/CachedAIService';

// HTTP Layer
import { AuthController } from '@infrastructure/http/controllers/AuthController';
import { ListController } from '@infrastructure/http/controllers/ListController';
import { ProductController } from '@infrastructure/http/controllers/ProductController';
import { CategoryController } from '@infrastructure/http/controllers/CategoryController';
import { StoreController } from '@infrastructure/http/controllers/StoreController';
import { InvitationController } from '@infrastructure/http/controllers/InvitationController';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { RecommendationsController } from '@infrastructure/http/controllers/RecommendationsController';
import { AIController } from '@infrastructure/http/controllers/AIController';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { RealTimeGateway } from '@infrastructure/realtime/RealTimeGateway';

// Interfaces
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { IAnalyticsRepository } from '@application/ports/repositories/IAnalyticsRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';
import type { IOutboxService } from '@application/ports/messaging/IOutboxService';
import type { IInvitationHashGenerator } from '@domain/services/InvitationHashGenerator';
import type { IEmailService } from '@application/ports/external/IEmailService';
import type { IAIService } from '@application/ports/external/IAIService';

export class Container {
  private static instance: Container;
  private _prisma!: PrismaClient;
  private readonly isTestEnv: boolean;

  // Repositories
  private _usuarioRepository!: IUsuarioRepository;
  private _listaRepository!: IListaRepository;
  private _productoRepository!: IProductoRepository;
  private _categoriaRepository!: ICategoriaRepository;
  private _tiendaRepository!: ITiendaRepository;
  private _invitacionRepository!: IInvitacionRepository;
  private _permisoRepository!: IPermisoRepository;
  private _analyticsRepository!: IAnalyticsRepository;

  // External Services
  private _passwordHasher!: IPasswordHasher;
  private _tokenService!: ITokenService;
  private _emailService!: IEmailService;
  private _aiService!: IAIService;
  private _cachedAIService!: CachedAIService;
  private _eventPublisher!: IEventPublisher;
  private _outboxService!: IOutboxService;
  private _outboxWorker!: OutboxWorker;
  private _hashGenerator!: IInvitationHashGenerator;
  private _workerService!: WorkerService;
  private _realTimeGateway!: RealTimeGateway;
  private _metricsCollector!: MetricsCollector;

  // Use Cases
  private _registerUser!: RegisterUser;
  private _authenticateUser!: AuthenticateUser;
  private _createList!: CreateList;
  private _getUserLists!: GetUserLists;
  private _updateList!: UpdateList;
  private _deleteList!: DeleteList;
  private _getListById!: GetListById;
  private _addProduct!: AddProduct;
  private _updateProduct!: UpdateProduct;
  private _markProductAsPurchased!: MarkProductAsPurchased;
  private _deleteProduct!: DeleteProduct;
  private _getProducts!: GetProducts;
  private _getProductRecommendations!: GetProductRecommendations;
  private _createCategory!: CreateCategory;
  private _getCategoriesByStore!: GetCategoriesByStore;
  private _updateCategory!: UpdateCategory;
  private _deleteCategory!: DeleteCategory;
  private _createStore!: CreateStore;
  private _getStores!: GetStores;
  private _updateStore!: UpdateStore;
  private _deleteStore!: DeleteStore;
  private _shareList!: ShareList;
  private _accessSharedList!: AccessSharedList;
  private _managePermissions!: ManagePermissions;
  private _cancelInvitation!: CancelInvitation;
  private _impersonateUser!: ImpersonateUser;
  private _endImpersonation!: EndImpersonation;
  private _bulkCategorizeProducts!: BulkCategorizeProducts;
  private _getCollaborativeDashboard!: GetCollaborativeDashboard;

  // Controllers
  private _authController!: AuthController;
  private _listController!: ListController;
  private _productController!: ProductController;
  private _categoryController!: CategoryController;
  private _storeController!: StoreController;
  private _invitationController!: InvitationController;
  private _adminController!: AdminController;
  private _recommendationsController!: RecommendationsController;
  private _aiController!: AIController;
  private _dashboardController!: DashboardController;

  // Middlewares
  private _authMiddleware!: express.RequestHandler;

  private constructor() {
    this.isTestEnv = process.env['NODE_ENV'] === 'test';
    this.initializeInfrastructure();
    this.initializeRepositories();
    this.initializeExternalServices();
    this.initializeUseCases();
    this.initializeRealtime();
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
    if (this.isTestEnv) {
      return;
    }
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    
    if (rabbitmqEnabled && this._eventPublisher instanceof RabbitMQEventPublisher) {
      try {
        await this._eventPublisher.initialize();
        console.log('✅ RabbitMQ inicializado correctamente');
        
        // Inicializar OutboxWorker (procesador de eventos)
        await this._outboxWorker.start();
        console.log('✅ OutboxWorker iniciado correctamente');
        
        // Inicializar WorkerService (consumers)
        await this._workerService.start();
        console.log('✅ Workers de notificaciones iniciados correctamente');
      } catch (error) {
        console.error('❌ Error al inicializar RabbitMQ:', error);
        // Fallback a un publisher que no haga nada
        this._eventPublisher = {
          publish: async (event: any) => {
            console.log(`📝 EventPublisher fallback - ${event.eventType} (${event.eventId})`);
            return success(undefined);
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
    // Detener OutboxWorker primero
    await this._outboxWorker.stop();
    console.log('✅ OutboxWorker detenido correctamente');
    
    // Detener workers
    await this._workerService.stop();
    console.log('✅ Workers detenidos correctamente');
    
    if (this._eventPublisher instanceof RabbitMQEventPublisher) {
      await this._eventPublisher.close();
    }
    
    if (!this.isTestEnv && this._prisma && typeof this._prisma.$disconnect === 'function') {
      await this._prisma.$disconnect();
      console.log('✅ Container cerrado correctamente');
    }
  }

  private initializeInfrastructure(): void {
    if (this.isTestEnv) {
      this._prisma = {} as PrismaClient;
      return;
    }

    this._prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  private initializeRepositories(): void {
    if (this.isTestEnv) {
      this._usuarioRepository = new InMemoryUsuarioRepository();
      this._listaRepository = new InMemoryListaRepository();
      this._productoRepository = new InMemoryProductoRepository();
      this._categoriaRepository = new InMemoryCategoriaRepository();
      this._tiendaRepository = new InMemoryTiendaRepository();
      this._invitacionRepository = new InMemoryInvitacionRepository();
      this._permisoRepository = new InMemoryPermisoRepository();
      this._analyticsRepository = {
        getCollaborativeDashboard: async () => success({
          summary: {
            totalLists: 0,
            activeLists: 0,
            sharedLists: 0,
            totalCollaborators: 0,
            totalProducts: 0,
            purchasedProducts: 0,
            pendingProducts: 0,
            urgentProducts: 0,
            completionRate: 0,
            averagePurchaseTimeHours: null
          },
          collaboration: {
            activeCollaborators: 0,
            leaderboard: [],
            sharedLists: []
          },
          patterns: {
            topCategories: [],
            weeklyActivity: []
          }
        })
      } as IAnalyticsRepository;
      return;
    }

    this._usuarioRepository = new PrismaUsuarioRepository(this._prisma);
    this._listaRepository = new PrismaListaRepository(this._prisma);
    this._productoRepository = new PrismaProductoRepository(this._prisma);
    this._categoriaRepository = new PrismaCategoriaRepository(this._prisma);
    this._tiendaRepository = new PrismaTiendaRepository(this._prisma);
    this._invitacionRepository = new PrismaInvitacionRepository(this._prisma);
    this._permisoRepository = new PrismaPermisoRepository(this._prisma);
    this._analyticsRepository = new PrismaAnalyticsRepository(this._prisma);
  }

  private initializeExternalServices(): void {
    this._passwordHasher = new BcryptPasswordHasher();
    this._tokenService = new JWTTokenService();
    this._hashGenerator = new InvitationHashGenerator();
    this._outboxService = this.isTestEnv
      ? new InMemoryOutboxService()
      : new PrismaOutboxService(this._prisma);
    
    // Configurar EmailService con valores por defecto (configuración pendiente)
    const emailConfig = {
      service: 'gmail',
      from: {
        name: 'Lista de Compra',
        email: process.env['EMAIL_USER'] || 'anthonymoles89@gmail.com'
      },
      auth: {
        user: process.env['EMAIL_USER'] || 'anthonymoles89@gmail.com',
        pass: process.env['EMAIL_PASS'] || 'snci srqq feok gkpp'
      },
      maxRetries: parseInt(process.env['EMAIL_MAX_RETRIES'] || '3'),
      retryDelay: parseInt(process.env['EMAIL_RETRY_DELAY'] || '1000')
    };
    this._emailService = new NodemailerService(emailConfig);
    
    // Configurar IA Service con cache (Perplexity + Redis opcional)
    const aiConfig: PerplexityConfig = {
      provider: 'perplexity',
      apiKey: process.env['PERPLEXITY_API_KEY'] || '',
      apiUrl: process.env['PERPLEXITY_API_URL'] || 'https://api.perplexity.ai',
      model: (process.env['PERPLEXITY_MODEL'] as any) || 'llama-3.1-sonar-small-128k-online',
      temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.1'),
      maxTokens: parseInt(process.env['AI_MAX_TOKENS'] || '1000'),
      timeout: parseInt(process.env['AI_TIMEOUT'] || '30000'),
      cache: {
        enabled: process.env['AI_CACHE_ENABLED'] === 'true',
        ttl: parseInt(process.env['AI_CACHE_TTL'] || '3600')
      },
      rateLimit: {
        requestsPerMinute: parseInt(process.env['AI_RATE_LIMIT_PER_MINUTE'] || '10')
      }
    };

    let redisConfig: RedisConfig | undefined;
    if (aiConfig.cache?.enabled) {
      try {
        redisConfig = getRedisConfig();
      } catch (error) {
        console.warn('⚠️ Redis no configurado correctamente, se continuará sin cache IA', error);
      }
    }

    const cachedAIDependencies: CachedAIServiceDependencies = { aiConfig };
    if (redisConfig) {
      cachedAIDependencies.redisConfig = redisConfig;
    }

    this._cachedAIService = new CachedAIService(cachedAIDependencies);
    this._aiService = this._cachedAIService;

    // Collector de métricas compartido para dashboard
    this._metricsCollector = new MetricsCollector();

    // Configurar EventPublisher según variables de entorno
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    const rabbitmqUrl = process.env['RABBITMQ_URL'] || 'amqp://guest:guest@localhost:5672';
    
    if (this.isTestEnv) {
      this._eventPublisher = {
        publish: async () => success(undefined),
      };
    } else if (rabbitmqEnabled) {
      this._eventPublisher = new RabbitMQEventPublisher(rabbitmqUrl);
      console.log('📡 Usando RabbitMQEventPublisher - RabbitMQ habilitado');
    } else {
      // Crear un EventPublisher que no haga nada si está deshabilitado
      this._eventPublisher = {
        publish: async (event: any) => {
          console.log(`📝 EventPublisher deshabilitado - ${event.eventType} (${event.eventId})`);
          return success(undefined);
        }
      };
      console.log('🔄 EventPublisher deshabilitado');
    }

    // Configurar WorkerService (consumers de RabbitMQ)
    if (this.isTestEnv) {
      this._workerService = {
        start: async () => success(undefined),
        stop: async () => success(undefined),
      } as unknown as WorkerService;
    } else {
      this._workerService = new WorkerService({
        rabbitmqUrl,
        enabled: rabbitmqEnabled,
        emailService: this._emailService,
        usuarioRepository: this._usuarioRepository,
        listaRepository: this._listaRepository
      });
    }

    // Configurar OutboxWorker (procesador de eventos outbox)
    if (this.isTestEnv) {
      this._outboxWorker = {
        start: async () => success(undefined),
        stop: async () => success(undefined),
      } as unknown as OutboxWorker;
    } else {
      this._outboxWorker = new OutboxWorker(
        this._outboxService,
        this._eventPublisher
      );
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

    this._getListById = new GetListById(
      this._listaRepository
    );

    // Product use cases
    this._addProduct = new AddProduct({
      productoRepository: this._productoRepository,
      listaRepository: this._listaRepository,
      categoriaRepository: this._categoriaRepository,
      tiendaRepository: this._tiendaRepository,
      aiService: this._aiService // Opcional
    });

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

    this._getProductRecommendations = new GetProductRecommendations(
      this._listaRepository,
      this._productoRepository,
      this._categoriaRepository,
      this._aiService
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

    // Invitation Use Cases
    this._shareList = new ShareList(
      this._listaRepository,
      this._usuarioRepository,
      this._invitacionRepository,
      this._permisoRepository,
      this._hashGenerator,
      this._outboxService
    );

    this._accessSharedList = new AccessSharedList(
      this._listaRepository,
      this._usuarioRepository,
      this._invitacionRepository,
      this._permisoRepository
    );

    this._managePermissions = new ManagePermissions(
      this._listaRepository,
      this._usuarioRepository,
      this._permisoRepository
    );

    this._cancelInvitation = new CancelInvitation(
      this._listaRepository,
      this._usuarioRepository,
      this._invitacionRepository,
      this._permisoRepository
    );

    this._impersonateUser = new ImpersonateUser(
      this._usuarioRepository,
      this._tokenService
    );

    this._endImpersonation = new EndImpersonation(
      this._usuarioRepository,
      this._tokenService
    );

    this._bulkCategorizeProducts = new BulkCategorizeProducts(
      this._aiService,
      this._usuarioRepository,
      this._categoriaRepository
    );

    this._getCollaborativeDashboard = new GetCollaborativeDashboard(
      this._analyticsRepository
    );
  }

  private initializeRealtime(): void {
    this._realTimeGateway = new RealTimeGateway();
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
      this._deleteList,
      this._getListById,
      this._realTimeGateway
    );

    this._productController = new ProductController(
      this._addProduct,
      this._updateProduct,
      this._markProductAsPurchased,
      this._deleteProduct,
      this._getProducts,
      this._realTimeGateway
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

    this._invitationController = new InvitationController(
      this._shareList,
      this._accessSharedList,
      this._managePermissions,
      this._cancelInvitation
    );

    this._adminController = new AdminController(
      this._impersonateUser,
      this._endImpersonation
    );

    this._recommendationsController = new RecommendationsController(
      this._getProductRecommendations
    );

    this._aiController = new AIController(
      undefined, // getCategorySuggestionsUseCase - por implementar
      this._bulkCategorizeProducts
    );

    this._dashboardController = new DashboardController(
      this._metricsCollector,
      this._cachedAIService,
      this._getCollaborativeDashboard
    );

    // Inicializar middleware de autenticación
    this._authMiddleware = createAuthMiddleware({
      tokenService: this._tokenService
    });
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

  public get outboxService(): IOutboxService {
    return this._outboxService;
  }

  public get outboxWorker(): OutboxWorker {
    return this._outboxWorker;
  }

  public get emailService(): IEmailService {
    return this._emailService;
  }

  public get aiService(): IAIService {
    return this._aiService;
  }

  public get workerService(): WorkerService {
    return this._workerService;
  }

  public get hashGenerator(): IInvitationHashGenerator {
    return this._hashGenerator;
  }

  public get invitacionRepository(): IInvitacionRepository {
    return this._invitacionRepository;
  }

  public get permisoRepository(): IPermisoRepository {
    return this._permisoRepository;
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

  public get shareList(): ShareList {
    return this._shareList;
  }

  public get accessSharedList(): AccessSharedList {
    return this._accessSharedList;
  }

  public get managePermissions(): ManagePermissions {
    return this._managePermissions;
  }

  public get cancelInvitation(): CancelInvitation {
    return this._cancelInvitation;
  }

  public get invitationController(): InvitationController {
    return this._invitationController;
  }

  public get adminController(): AdminController {
    return this._adminController;
  }

  public get recommendationsController(): RecommendationsController {
    return this._recommendationsController;
  }

  public get aiController(): AIController {
    return this._aiController;
  }

  public get dashboardController(): DashboardController {
    return this._dashboardController;
  }

  public get authMiddleware(): express.RequestHandler {
    return this._authMiddleware;
  }

  public get realTimeGateway(): RealTimeGateway {
    return this._realTimeGateway;
  }

  /**
   * Conecta a la base de datos
   */
  public async connect(): Promise<void> {
    try {
      if (this.isTestEnv) {
        return;
      }
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
      if (this.isTestEnv) {
        return;
      }
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
      if (this.isTestEnv) {
        return true;
      }
      await this._prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Health check de base de datos falló:', error);
      return false;
    }
  }
}
