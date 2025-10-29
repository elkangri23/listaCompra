/**
 * Extensiones de tipos para Express
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
        rol?: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    userId: string;
    email: string;
    rol?: string;
  };
}