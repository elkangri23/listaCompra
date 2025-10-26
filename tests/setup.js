"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.test' });
global.beforeAll(async () => {
    console.log('🧪 Configurando entorno de testing...');
});
global.afterAll(async () => {
    console.log('🧹 Limpiando entorno de testing...');
});
jest.setTimeout(30000);
const originalConsole = console;
global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error,
};
//# sourceMappingURL=setup.js.map