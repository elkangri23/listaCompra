import * as swaggerJSDoc from 'swagger-jsdoc';
import { Express } from 'express';
import * as swaggerUi from 'swagger-ui-express';

/**
 * Configuración de OpenAPI/Swagger para la API de Lista de la Compra
 */
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lista de la Compra Colaborativa - API',
      version: '2.0.0',
      description: 
        '# Lista de la Compra Colaborativa API\n\n' +
        'Sistema backend de gestión de **listas de compra colaborativas** con arquitectura hexagonal, ' +
        'inteligencia artificial y funcionalidades empresariales de seguridad.\n\n' +
        '## Características Principales\n\n' +
        '### 🏗️ Arquitectura\n' +
        '- **Arquitectura Hexagonal** con separación de responsabilidades\n' +
        '- **Principios SOLID** aplicados consistentemente\n' +
        '- **Patrón Outbox** para consistencia eventual\n' +
        '- **Mensajería asíncrona** con RabbitMQ\n\n' +
        '### 🛡️ Seguridad Empresarial\n' +
        '- **JWT Authentication** con roles diferenciados\n' +
        '- **SecurityAuditService** con 20+ tipos de eventos auditados\n' +
        '- **Rate Limiting Adaptativo** con análisis comportamental\n' +
        '- **Input Sanitization** contra OWASP Top 10\n' +
        '- **Cache Integrity** con checksums múltiples\n' +
        '- **Puntuación de seguridad**: 9.5/10\n\n' +
        '### 🤖 Inteligencia Artificial\n' +
        '- **Categorización automática** de productos con Perplexity AI\n' +
        '- **Cache inteligente** para optimización de costos\n' +
        '- **Sugerencias contextuales** por tienda específica\n\n' +
        '### 📊 Observabilidad\n' +
        '- **Métricas en tiempo real** de todos los endpoints\n' +
        '- **Logs estructurados** con Winston\n' +
        '- **Dashboard administrativo** con health checks\n' +
        '- **Alertas automáticas** basadas en thresholds\n\n' +
        '## Autenticación\n\n' +
        'La mayoría de endpoints requieren autenticación JWT. Para autenticarse:\n\n' +
        '1. **Registrarse** o **iniciar sesión** en `/api/v1/auth/register` o `/api/v1/auth/login`\n' +
        '2. **Usar el token** recibido en el header: `Authorization: Bearer <token>`\n\n' +
        '## Roles de Usuario\n\n' +
        '- **Usuario Normal**: Acceso a sus propias listas y funcionalidades básicas\n' +
        '- **Invitado**: Acceso temporal a listas compartidas específicas\n' +
        '- **Administrador**: Acceso completo + funcionalidades de impersonación\n\n' +
        '## Rate Limiting\n\n' +
        '- **General**: 100 requests/15min por IP\n' +
        '- **IA Endpoints**: 10 requests/min por usuario\n' +
        '- **Admin Endpoints**: Límites específicos por criticidad\n\n' +
        '## Códigos de Error Comunes\n\n' +
        '- **400**: Bad Request - Datos de entrada inválidos\n' +
        '- **401**: Unauthorized - Token JWT faltante o inválido\n' +
        '- **403**: Forbidden - Permisos insuficientes\n' +
        '- **404**: Not Found - Recurso no encontrado\n' +
        '- **429**: Too Many Requests - Rate limit excedido\n' +
        '- **500**: Internal Server Error - Error interno del servidor',
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
        url: 'http://localhost:3000',
        description: 'Servidor de Desarrollo'
      },
      {
        url: 'https://api.listacompra.com',
        description: 'Servidor de Producción'
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
        // Esquemas de respuesta comunes
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
            },
            path: {
              type: 'string',
              description: 'Ruta donde ocurrió el error'
            },
            requestId: {
              type: 'string',
              description: 'ID único de la request para tracking'
            }
          },
          required: ['error', 'timestamp']
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Datos de entrada inválidos'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // Entidades de dominio
        Usuario: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único del usuario'
            },
            nombre: {
              type: 'string',
              description: 'Nombre del usuario',
              example: 'Juan'
            },
            apellidos: {
              type: 'string',
              description: 'Apellidos del usuario',
              example: 'Pérez García'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del usuario',
              example: 'juan@ejemplo.com'
            },
            rol: {
              type: 'string',
              enum: ['USUARIO', 'ADMIN'],
              description: 'Rol del usuario en el sistema'
            },
            activo: {
              type: 'boolean',
              description: 'Si el usuario está activo'
            },
            emailVerificado: {
              type: 'boolean',
              description: 'Si el email ha sido verificado'
            },
            creadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'email', 'rol', 'activo', 'emailVerificado']
        },
        Lista: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único de la lista'
            },
            nombre: {
              type: 'string',
              description: 'Nombre de la lista',
              example: 'Compra semanal'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción opcional de la lista',
              example: 'Lista para la compra semanal del hogar'
            },
            propietarioId: {
              type: 'string',
              format: 'uuid',
              description: 'ID del propietario de la lista'
            },
            tiendaId: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la tienda asociada (opcional)'
            },
            activa: {
              type: 'boolean',
              description: 'Si la lista está activa'
            },
            creadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'propietarioId', 'activa']
        },
        Producto: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único del producto'
            },
            nombre: {
              type: 'string',
              description: 'Nombre del producto',
              example: 'Leche entera'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción del producto',
              example: 'Leche entera 1L marca Pascual'
            },
            cantidad: {
              type: 'number',
              description: 'Cantidad a comprar',
              example: 2
            },
            precio: {
              type: 'number',
              format: 'float',
              description: 'Precio unitario del producto',
              example: 1.25
            },
            comprado: {
              type: 'boolean',
              description: 'Si el producto ya fue comprado'
            },
            urgente: {
              type: 'boolean',
              description: 'Si el producto es urgente'
            },
            listaId: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la lista a la que pertenece'
            },
            categoriaId: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la categoría (opcional)'
            },
            creadoPorId: {
              type: 'string',
              format: 'uuid',
              description: 'ID del usuario que creó el producto'
            },
            creadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'cantidad', 'comprado', 'urgente', 'listaId', 'creadoPorId']
        },
        Categoria: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único de la categoría'
            },
            nombre: {
              type: 'string',
              description: 'Nombre de la categoría',
              example: 'Lácteos'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción de la categoría',
              example: 'Productos lácteos y derivados'
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Color en formato hexadecimal',
              example: '#FF5733'
            },
            tiendaId: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la tienda (opcional, null para categorías generales)'
            },
            activa: {
              type: 'boolean',
              description: 'Si la categoría está activa'
            },
            creadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'color', 'activa']
        },
        Tienda: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único de la tienda'
            },
            nombre: {
              type: 'string',
              description: 'Nombre de la tienda',
              example: 'Mercadona'
            },
            direccion: {
              type: 'string',
              description: 'Dirección de la tienda',
              example: 'Calle Mayor 123, Madrid'
            },
            telefono: {
              type: 'string',
              description: 'Teléfono de la tienda',
              example: '+34 91 123 45 67'
            },
            sitioWeb: {
              type: 'string',
              format: 'uri',
              description: 'Sitio web de la tienda',
              example: 'https://www.mercadona.es'
            },
            activa: {
              type: 'boolean',
              description: 'Si la tienda está activa'
            },
            creadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadaEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'activa']
        },
        Blueprint: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID único del blueprint'
            },
            nombre: {
              type: 'string',
              description: 'Nombre del blueprint',
              example: 'Lista básica semanal'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción del blueprint',
              example: 'Plantilla para compra semanal básica'
            },
            productos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string', example: 'Leche' },
                  cantidad: { type: 'number', example: 1 },
                  notas: { type: 'string', example: 'Entera 1L' },
                  categoriaId: { type: 'string', format: 'uuid' }
                },
                required: ['nombre', 'cantidad']
              },
              description: 'Lista de productos predefinidos'
            },
            esPublico: {
              type: 'boolean',
              description: 'Si el blueprint es público'
            },
            creadoPorId: {
              type: 'string',
              format: 'uuid',
              description: 'ID del usuario que creó el blueprint'
            },
            activo: {
              type: 'boolean',
              description: 'Si el blueprint está activo'
            },
            creadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            actualizadoEn: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización'
            }
          },
          required: ['id', 'nombre', 'productos', 'esPublico', 'creadoPorId', 'activo']
        },
        // DTOs de respuesta
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token JWT para autenticación',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            user: {
              $ref: '#/components/schemas/Usuario'
            },
            expiresIn: {
              type: 'string',
              description: 'Tiempo de expiración del token',
              example: '7d'
            }
          },
          required: ['token', 'user', 'expiresIn']
        },
        AIResponse: {
          type: 'object',
          properties: {
            requestId: {
              type: 'string',
              description: 'ID único de la request',
              example: 'req_abc123'
            },
            productName: {
              type: 'string',
              description: 'Nombre del producto analizado',
              example: 'Leche entera'
            },
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  categoria: { type: 'string', example: 'Lácteos' },
                  confianza: { type: 'number', format: 'float', example: 0.95 },
                  razon: { type: 'string', example: 'Producto lácteo típico' }
                }
              },
              description: 'Lista de sugerencias de categorización'
            },
            cached: {
              type: 'boolean',
              description: 'Si la respuesta proviene del cache'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp de la respuesta'
            }
          },
          required: ['requestId', 'productName', 'suggestions', 'cached', 'timestamp']
        },
        // DTOs de métricas y dashboard
        DashboardMetrics: {
          type: 'object',
          properties: {
            system: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number' },
                averageResponseTime: { type: 'number' },
                errorRate: { type: 'number' },
                uptime: { type: 'number' }
              }
            },
            cache: {
              type: 'object',
              properties: {
                hitRatio: { type: 'number' },
                totalOperations: { type: 'number' },
                averageResponseTime: { type: 'number' }
              }
            },
            endpoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  method: { type: 'string' },
                  count: { type: 'number' },
                  averageTime: { type: 'number' },
                  errors: { type: 'number' }
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticación faltante o inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Token de autorización requerido',
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Permisos insuficientes para acceder al recurso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'No tienes permisos para acceder a este recurso',
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Recurso no encontrado',
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        },
        ValidationError: {
          description: 'Error de validación en los datos de entrada',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              },
              example: {
                error: 'Datos de entrada inválidos',
                details: [
                  {
                    field: 'email',
                    message: 'El email debe tener un formato válido'
                  }
                ],
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit excedido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Rate limit excedido. Intenta de nuevo en unos minutos.',
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Error interno del servidor',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Error interno del servidor',
                timestamp: '2024-10-29T10:30:00Z'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Autenticación',
        description: 'Endpoints de registro, login y gestión de autenticación'
      },
      {
        name: 'Listas',
        description: 'CRUD de listas de compra y gestión de colaboración'
      },
      {
        name: 'Productos',
        description: 'Gestión de productos dentro de las listas'
      },
      {
        name: 'Categorías',
        description: 'Gestión de categorías y organización de productos'
      },
      {
        name: 'Tiendas',
        description: 'Gestión de tiendas y asociación con listas'
      },
      {
        name: 'Invitaciones',
        description: 'Sistema de compartición de listas y gestión de permisos'
      },
      {
        name: 'Blueprints',
        description: 'Plantillas reutilizables de listas de compra'
      },
      {
        name: 'Inteligencia Artificial',
        description: 'Categorización automática y sugerencias inteligentes'
      },
      {
        name: 'Administración',
        description: 'Funcionalidades administrativas e impersonación de usuarios'
      },
      {
        name: 'Dashboard',
        description: 'Métricas, monitoreo y health checks del sistema'
      },
      {
        name: 'Cache Integrity',
        description: 'Gestión de integridad de cache y herramientas administrativas'
      },
      {
        name: 'Analytics',
        description: 'Análisis de cache y métricas de rendimiento'
      }
    ]
  },
  apis: [
    './src/infrastructure/http/routes/*.ts',
    './src/infrastructure/http/controllers/*.ts'
  ]
};

/**
 * Configurar Swagger UI en la aplicación Express
 */
export function setupSwagger(app: Express): void {
  const specs = (swaggerJSDoc as any).default ? (swaggerJSDoc as any).default(swaggerOptions) : (swaggerJSDoc as any)(swaggerOptions);
  
  // Endpoint para la especificación JSON de OpenAPI
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
  
  // UI de Swagger accesible en /api/docs
  app.use('/api/docs', (swaggerUi as any).serve, (swaggerUi as any).setup(specs, {
    customfavIcon: '/favicon.ico',
    customSiteTitle: 'Lista de la Compra - API Docs',
    customCssUrl: '/api/docs/custom.css',
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true
    }
  }));
  
  console.log('📚 Swagger UI disponible en: http://localhost:3000/api/docs');
  console.log('📄 OpenAPI spec disponible en: http://localhost:3000/api/docs.json');
}

export default swaggerOptions;