/**
 * Tipos personalizados para Express
 */

import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId: string;
    email: string;
    role: string;
    rol?: string;
  };
}
