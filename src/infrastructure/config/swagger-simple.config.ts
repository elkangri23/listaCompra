import * as swaggerJSDoc from 'swagger-jsdoc';
import type { Express } from 'express';
import * as swaggerUi from 'swagger-ui-express';

/**
 * Configuración básica de OpenAPI/Swagger para la API
 */
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lista de la Compra Colaborativa - API',
      version: '2.0.0',
      description: 'Sistema backend de gestión de listas de compra colaborativas con arquitectura hexagonal, inteligencia artificial y funcionalidades empresariales de seguridad.',
      contact: {
        name: 'Lista de la Compra API',
        email: 'support@listacompra.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3333',
        description: 'Servidor de Desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del endpoint de login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensaje de error descriptivo'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp del error en formato ISO'
            }
          },
          required: ['error', 'timestamp']
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nombre: { type: 'string', example: 'Juan' },
            apellidos: { type: 'string', example: 'Pérez García' },
            email: { type: 'string', format: 'email', example: 'juan@ejemplo.com' },
            rol: { type: 'string', enum: ['USUARIO', 'ADMIN'] },
            activo: { type: 'boolean' },
            emailVerificado: { type: 'boolean' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Token JWT' },
            user: { $ref: '#/components/schemas/Usuario' },
            expiresIn: { type: 'string', example: '7d' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticación faltante o inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Error de validación en los datos de entrada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Autenticación', description: 'Endpoints de registro, login y gestión de autenticación' },
      { name: 'Listas', description: 'CRUD de listas de compra y colaboración' },
      { name: 'Productos', description: 'Gestión de productos dentro de listas' },
      { name: 'Categorías', description: 'Gestión de categorías de productos' },
      { name: 'Tiendas', description: 'Gestión de tiendas y localizaciones' },
      { name: 'Invitaciones', description: 'Sistema de colaboración e invitaciones' },
      { name: 'Plantillas', description: 'Gestión de blueprints y plantillas de listas' },
      { name: 'Inteligencia Artificial', description: 'Categorización automática y sugerencias' },
      { name: 'Recomendaciones', description: 'Recomendaciones contextuales de productos' },
      { name: 'Administración', description: 'Funciones administrativas y auditoría' },
      { name: 'Auditoría', description: 'Sistema de auditoría y logs de acciones' },
      { name: 'Dashboard', description: 'Métricas y análisis de datos' },
      { name: 'Desarrollo', description: 'Herramientas de desarrollo y testing' }
    ]
  },
  apis: [
    './src/infrastructure/http/routes/authRoutes.ts',
    './src/infrastructure/http/routes/listRoutes.ts',
    './src/infrastructure/http/routes/productRoutes.ts',
    './src/infrastructure/http/routes/categoryRoutes.ts',
    './src/infrastructure/http/routes/storeRoutes.ts',
    './src/infrastructure/http/routes/invitationRoutes.ts',
    './src/infrastructure/http/routes/blueprintRoutes.ts',
    './src/infrastructure/http/routes/aiRoutes.ts',
    './src/infrastructure/http/routes/recommendationsRoutes.ts',
    './src/infrastructure/http/routes/adminRoutes.ts',
    './src/infrastructure/http/routes/audit.routes.ts',
    './src/infrastructure/http/routes/dashboardRoutes.ts',
    './src/infrastructure/http/routes/devRoutes.ts'
  ]
};

/**
 * Configurar Swagger UI en la aplicación Express (versión simplificada)
 */
export function setupSwagger(app: Express): void {
  try {
    const specs = (swaggerJSDoc as any).default 
      ? (swaggerJSDoc as any).default(swaggerOptions) 
      : (swaggerJSDoc as any)(swaggerOptions);
    
    // Endpoint para la especificación JSON
    app.get('/api/docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });
    
    // UI de Swagger
    app.use('/api/docs', (swaggerUi as any).serve, (swaggerUi as any).setup(specs, {
      customSiteTitle: 'Lista de la Compra - API Docs',
      swaggerOptions: {
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true
      }
    }));
    
    console.log('📚 Swagger UI disponible en: http://localhost:3333/api/docs');
    console.log('📄 OpenAPI spec disponible en: http://localhost:3333/api/docs.json');
  } catch (error) {
    console.warn('⚠️ Error configurando Swagger:', error);
  }
}

export default swaggerOptions;