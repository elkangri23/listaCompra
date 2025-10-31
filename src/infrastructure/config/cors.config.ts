/**
 * Configuración CORS estricta para producción
 * Protege contra ataques de sitios cruzados
 */

import { CorsOptions } from 'cors';

/**
 * Orígenes permitidos por entorno
 */
const getAllowedOrigins = (): string[] => {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  
  switch (nodeEnv) {
    case 'production':
      // 🔒 En producción: solo dominios específicos autorizados
      return [
        'https://listacompra.tudominio.com',
        'https://app.listacompra.tudominio.com',
        'https://www.listacompra.tudominio.com',
        // Añadir otros dominios de producción según sea necesario
      ];
      
    case 'staging':
      // 🟡 En staging: dominios de staging y testing
      return [
        'https://staging.listacompra.tudominio.com',
        'https://test.listacompra.tudominio.com',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      
    case 'development':
    case 'test':
    default:
      // 🟢 En desarrollo: más permisivo pero aún controlado
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:4200',  // Angular dev server
        'http://localhost:5173',  // Vite dev server
        'http://localhost:8080',  // Webpack dev server
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
      ];
  }
};

/**
 * Verificar si un origen está permitido
 */
const isOriginAllowed = (origin: string | undefined): boolean => {
  const allowedOrigins = getAllowedOrigins();
  
  // En desarrollo, permitir requests sin origin (Postman, etc.)
  if (!origin && process.env['NODE_ENV'] !== 'production') {
    return true;
  }
  
  // Verificar si el origin está en la lista permitida
  return origin ? allowedOrigins.includes(origin) : false;
};

/**
 * Configuración CORS estricta
 */
export const corsConfig: CorsOptions = {
  // Función para verificar origins dinámicamente
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      const error = new Error(`CORS: Origen '${origin || 'undefined'}' no permitido`);
      callback(error, false);
    }
  },
  
  // Métodos HTTP permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Headers permitidos en requests
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'X-API-Key',
  ],
  
  // Headers expuestos al cliente
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  
  // Permitir envío de cookies/credenciales
  credentials: true,
  
  // Caché de preflight (OPTIONS) en segundos
  maxAge: process.env['NODE_ENV'] === 'production' ? 7200 : 300, // 2h en prod, 5min en dev
  
  // ⚠️ NUNCA poner optionsSuccessStatus en producción
  optionsSuccessStatus: process.env['NODE_ENV'] === 'production' ? 204 : 200,
  
  // Bloquear requests con preflight inválido
  preflightContinue: false,
};

/**
 * Headers de seguridad adicionales para CORS
 */
export const corsSecurityHeaders = {
  // Prevenir embedding en iframes
  'X-Frame-Options': 'DENY',
  
  // Prevenir MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Política de referrer estricta
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Política de permisos restrictiva
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};