/**
 * Configuración y bootstrap del servidor HTTP
 */

import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRateLimit } from './middlewares/rateLimitMiddleware';
import { corsConfig, corsSecurityHeaders } from '../config/cors.config';
import { errorMiddleware, notFoundMiddleware, requestIdMiddleware, httpLoggerMiddleware } from './middlewares/errorMiddleware';
import { traceContextMiddleware } from './middlewares/tracingMiddleware';
import { setupSwagger } from '../config/swagger-simple.config';
import type { AuthController } from './controllers/AuthController';
import type { InvitationController } from './controllers/InvitationController';
import type { AdminController } from './controllers/AdminController';
import type { AIController } from './controllers/AIController';
import type { ListController } from './controllers/ListController';
import type { ProductController } from './controllers/ProductController';
import type { CategoryController } from './controllers/CategoryController';
import type { DashboardController } from './controllers/DashboardController';
import type { AuditController } from './controllers/AuditController';
import { createAuthRoutes } from './routes/authRoutes';
import { createInvitationRoutes } from './routes/invitationRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { createAIRoutes } from './routes/aiRoutes';
import { createDashboardRoutes } from './routes/dashboardRoutes';
import recommendationsRoutes from './routes/recommendationsRoutes';
import { devRoutes } from './routes/devRoutes';
import { auditRoutes } from './routes/audit.routes';

export interface ServerDependencies {
  authController: AuthController;
  invitationController: InvitationController;
  adminController: AdminController;
  aiController: AIController;
  authMiddleware: express.RequestHandler;
  listController: ListController;
  productController: ProductController;
  categoryController: CategoryController;
  dashboardController?: DashboardController;
  auditController: AuditController;
}

export async function createServer(dependencies: ServerDependencies): Promise<Application> {
  const app = express();

  // 🆔 Request ID para tracking
  app.use(requestIdMiddleware);

  // 🔍 Propagar contexto de tracing distribuido
  app.use(traceContextMiddleware);

  // 🔒 Headers de seguridad con Helmet (configuración estricta)
  app.use(helmet({
    // Política de Seguridad de Contenido estricta
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Para Swagger UI
        scriptSrc: ["'self'", "'unsafe-inline'"], // Para Swagger UI
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Política de referrer estricta
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Headers adicionales de seguridad
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    xssFilter: true,
  }));

  // 📊 Rate limiting global (protección DDoS)
  app.use(apiRateLimit);
  
  // 🌐 CORS estricto
  app.use(cors(corsConfig));
  
  // Headers adicionales de seguridad
  app.use((_req, res, next) => {
    Object.entries(corsSecurityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
    next();
  });

  // 📝 HTTP Logging (reemplaza Morgan)
  if (process.env['NODE_ENV'] !== 'test') {
    app.use(httpLoggerMiddleware);
  }

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 📚 Documentación Swagger (debe ir después de parsers)
  setupSwagger(app);

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'],
    });
  });

  // Ruta básica
  app.get('/', (_req, res) => {
    res.json({
      message: '🛒 Lista de Compra Colaborativa API',
      version: '2.0.0',
      documentation: '/api/docs',
      openapi: '/api/docs.json'
    });
  });


  // Rutas de la aplicación
  app.use('/api/v1/auth', createAuthRoutes(dependencies.authController));
  app.use('/api/v1/invitations', createInvitationRoutes({
    invitationController: dependencies.invitationController,
    authMiddleware: dependencies.authMiddleware
  }));
  app.use('/api/v1/admin', createAdminRoutes(
    dependencies.adminController,
    dependencies.authMiddleware,
    dependencies.authMiddleware // Por ahora usar authMiddleware en lugar de adminMiddleware
  ));
  app.use('/api/v1/ai', createAIRoutes({
    aiController: dependencies.aiController,
    authMiddleware: dependencies.authMiddleware
  }));
  app.use('/api/v1/recommendations', recommendationsRoutes);

  // NUEVO: Rutas de listas
  const { listController, productController, categoryController, authMiddleware } = dependencies;
  const { createListRoutes } = require('./routes/listRoutes');
  const { createProductRoutes } = require('./routes/productRoutes');
  const { createCategoryRoutes } = require('./routes/categoryRoutes');

  app.use('/api/v1/lists', createListRoutes(listController, authMiddleware));
  app.use('/api/v1/lists', createProductRoutes(productController, authMiddleware));
  app.use('/api/v1/categories', createCategoryRoutes(categoryController));

  if (dependencies.dashboardController) {
    app.use('/api/v1/dashboard', createDashboardRoutes({
      dashboardController: dependencies.dashboardController,
      authMiddleware: dependencies.authMiddleware
    }));
  }

  // Rutas de auditoría
  app.use('/api/v1', auditRoutes);

  // Rutas de desarrollo (solo en development)
  app.use('/api/v1/dev', devRoutes);

  // 🚫 Middleware para rutas no encontradas (404)
  app.use('*', notFoundMiddleware);

  // ⚠️ Middleware centralizado de manejo de errores (DEBE IR AL FINAL)
  app.use(errorMiddleware);

  return app;
}
