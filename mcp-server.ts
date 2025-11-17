// listaCompra/mcp-server.ts

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Crear servidor MCP
const server = new McpServer({
    name: 'listacompra-backend',
    version: '1.0.0',
    description: 'Backend MCP para listaCompra - Expone API docs, entities y tipos'
});

// ===== RESOURCE 1: Swagger/OpenAPI Documentation =====
// Esto expone tu documentación del API en formato Swagger/OpenAPI
server.registerResource(
    'swagger-docs',
    'resource://backend/swagger',
    {
        title: 'API Swagger Documentation',
        description: 'Documentación Swagger/OpenAPI de todos los endpoints',
        mimeType: 'application/json'
    },
    async (uri) => {
        try {
            // Leer el archivo swagger.json del backend
            const swaggerPath = path.join(process.cwd(), 'swagger.json');
            const swaggerContent = await fs.readFile(swaggerPath, 'utf-8');
            
            return {
                contents: [{
                    uri: uri.href,
                    text: swaggerContent
                }]
            };
        } catch (error) {
            const err = error as Error;
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: No se pudo leer swagger.json: ${err.message}`
                }]
            };
        }
    }
);

// ===== RESOURCE 2: Entities del Dominio =====
// Expone todos los archivos TypeScript de las entities
server.registerResource(
    'domain-entities',
    'resource://backend/domain/{entity}',
    {
        title: 'Domain Entities',
        description: 'Entidades de dominio del backend (ShoppingList, ListItem, User, etc)',
        mimeType: 'text/typescript'
    },
    async (uri, { entity }) => {
        try {
            // Buscar el archivo de la entidad en src/domain
            const entityPath = path.join(process.cwd(), 'src', 'domain', `${entity}.ts`);
            const entityContent = await fs.readFile(entityPath, 'utf-8');
            
            return {
                contents: [{
                    uri: uri.href,
                    text: entityContent
                }]
            };
        } catch (error) {
            const err = error as Error;
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: Entidad ${entity} no encontrada: ${err.message}`
                }]
            };
        }
    }
);

// ===== RESOURCE 3: Lista de Entities disponibles =====
// Proporciona una lista de todas las entities disponibles
server.registerResource(
    'entities-list',
    'resource://backend/entities',
    {
        title: 'Available Entities',
        description: 'Lista de todas las entities disponibles en el dominio',
        mimeType: 'application/json'
    },
    async (uri) => {
        try {
            // Leer los archivos en src/domain
            const domainPath = path.join(process.cwd(), 'src', 'domain');
            const files = await fs.readdir(domainPath);
            
            // Filtrar solo archivos .ts y excluir .spec.ts
            const entities = files
                .filter(f => f.endsWith('.ts') && !f.includes('.spec.'))
                .map(f => f.replace('.ts', ''));
            
            const list = {
                total: entities.length,
                entities: entities,
                description: 'Usa resource://backend/domain/{entity} para obtener una entity específica'
            };
            
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(list, null, 2)
                }]
            };
        } catch (error) {
            const err = error as Error;
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: ${err.message}`
                }]
            };
        }
    }
);

// ===== RESOURCE 4: API Endpoints Summary =====
// Resumen de todos los endpoints disponibles
server.registerResource(
    'api-endpoints',
    'resource://backend/endpoints',
    {
        title: 'API Endpoints Summary',
        description: 'Resumen de los endpoints principales del API',
        mimeType: 'application/json'
    },
    async (uri) => {
        try {
            // Leer swagger.json y extraer endpoints
            const swaggerPath = path.join(process.cwd(), 'swagger.json');
            const swaggerContent = await fs.readFile(swaggerPath, 'utf-8');
            const swagger = JSON.parse(swaggerContent);
            
            const endpoints = swagger.paths ? Object.keys(swagger.paths).map(path => ({
                path,
                methods: Object.keys(swagger.paths[path]).filter(m => 
                    ['get', 'post', 'put', 'delete', 'patch'].includes(m)
                )
            })) : [];
            
            const summary = {
                total: endpoints.length,
                endpoints,
                description: 'Consulta resource://backend/swagger para ver la documentación completa'
            };
            
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(summary, null, 2)
                }]
            };
        } catch (error) {
            const err = error as Error;
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error: ${err.message}`
                }]
            };
        }
    }
);

// ===== TOOL 1: Leer Entity específica =====
// Permite consultar una entidad del dominio de forma más directa
server.registerTool(
    'read-domain-entity',
    {
        title: 'Read Domain Entity',
        description: 'Lee una entidad específica del dominio del backend',
        inputSchema: {
            entityName: z.string().describe('Nombre de la entidad (ej: ShoppingList, ListItem, User)')
        },
        outputSchema: {
            name: z.string(),
            path: z.string(),
            content: z.string()
        }
    },
    async ({ entityName }) => {
        try {
            const entityPath = path.join(process.cwd(), 'src', 'domain', `${entityName}.ts`);
            const content = await fs.readFile(entityPath, 'utf-8');
            
            const output = {
                name: entityName,
                path: entityPath,
                content: content
            };
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(output, null, 2)
                }],
                structuredContent: output
            };
        } catch (error) {
            const err = error as Error;
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${err.message}`
                }],
                isError: true
            };
        }
    }
);

// ===== TOOL 2: Listar todas las entities =====
server.registerTool(
    'list-entities',
    {
        title: 'List All Domain Entities',
        description: 'Lista todas las entidades disponibles en el dominio',
        inputSchema: {},
        outputSchema: {
            entities: z.array(z.string()),
            total: z.number()
        }
    },
    async () => {
        try {
            const domainPath = path.join(process.cwd(), 'src', 'domain');
            const files = await fs.readdir(domainPath);
            
            const entities = files
                .filter(f => f.endsWith('.ts') && !f.includes('.spec.'))
                .map(f => f.replace('.ts', ''));
            
            const output = {
                entities,
                total: entities.length
            };
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(output, null, 2)
                }],
                structuredContent: output
            };
        } catch (error) {
            const err = error as Error;
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${err.message}`
                }],
                isError: true
            };
        }
    }
);

// ===== TOOL 3: Obtener endpoint específico del Swagger =====
server.registerTool(
    'get-endpoint-details',
    {
        title: 'Get Endpoint Details',
        description: 'Obtiene detalles específicos de un endpoint del Swagger',
        inputSchema: {
            endpoint: z.string().describe('Endpoint (ej: /api/lists)'),
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('Método HTTP')
        },
        outputSchema: {
            endpoint: z.string(),
            method: z.string(),
            details: z.any()
        }
    },
    async ({ endpoint, method }) => {
        try {
            const swaggerPath = path.join(process.cwd(), 'swagger.json');
            const swaggerContent = await fs.readFile(swaggerPath, 'utf-8');
            const swagger = JSON.parse(swaggerContent);
            
            const endpointPath = swagger.paths?.[endpoint];
            if (!endpointPath) {
                throw new Error(`Endpoint ${endpoint} no encontrado en Swagger`);
            }
            
            const methodKey = method.toLowerCase();
            const methodDetails = endpointPath[methodKey];
            if (!methodDetails) {
                throw new Error(`Método ${method} no disponible para ${endpoint}`);
            }
            
            const output = {
                endpoint,
                method,
                details: methodDetails
            };
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(output, null, 2)
                }],
                structuredContent: output
            };
        } catch (error) {
            const err = error as Error;
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${err.message}`
                }],
                isError: true
            };
        }
    }
);

// ===== PROMPT 1: Context para desarrollar Frontend =====
server.registerPrompt(
    'frontend-context',
    {
        title: 'Frontend Development Context',
        description: 'Proporciona contexto completo del backend para desarrollar frontend',
        argsSchema: {
            task: z.string().describe('Tarea que quieres hacer en el frontend (ej: crear formulario de lista)')
        }
    },
    ({ task }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: `Voy a desarrollar en el frontend. Mi tarea es: ${task}

Por favor:
1. Consulta el Swagger del backend (resource://backend/swagger) para entender los endpoints
2. Consulta las entidades del dominio (resource://backend/domain) 
3. Ayúdame a crear el código del frontend sincronizado con el backend
4. Asegúrate de que los tipos y la estructura sean correctos

Necesito que el código esté completamente tipado con TypeScript y sincronizado con el backend.`
            }
        }]
    })
);

// ===== SETUP: Express y HTTP Transport =====
const app = express();
app.use(express.json());

// Endpoint para MCP
app.post('/mcp', async (req, res) => {
    try {
        // Crear transporte HTTP para MCP
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });

        res.on('close', () => {
            transport.close();
        });

        // Conectar el servidor al transporte
        await server.connect(transport);
        
        // Procesar la petición MCP
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null
            });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Backend MCP Server is running' });
});

// Detectar si usar stdio o HTTP
const USE_STDIO = process.env.USE_STDIO === 'true';

if (USE_STDIO) {
    // Modo stdio para Cline
    console.error('🔌 Backend MCP Server starting in STDIO mode');
    const transport = new StdioServerTransport();
    server.connect(transport).catch((error: Error) => {
        console.error('STDIO transport error:', error);
        process.exit(1);
    });
} else {
    // Modo HTTP para uso manual
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`✅ Backend MCP Server running on http://localhost:${PORT}/mcp`);
        console.log(`📚 Resources disponibles:`);
        console.log(`   - resource://backend/swagger          (Swagger/OpenAPI docs)`);
        console.log(`   - resource://backend/entities         (Lista de entities)`);
        console.log(`   - resource://backend/domain/{entity}  (Entity específica)`);
        console.log(`   - resource://backend/endpoints        (Summary de endpoints)`);
        console.log(`🔧 Tools disponibles:`);
        console.log(`   - read-domain-entity                  (Leer entity)`);
        console.log(`   - list-entities                       (Listar entities)`);
        console.log(`   - get-endpoint-details                (Obtener detalles de endpoint)`);
    }).on('error', (error: Error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}
