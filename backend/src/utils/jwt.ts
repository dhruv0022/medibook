import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { UserRole } from '../types';

interface JwtPayload {
  id: string;
  role: UserRole;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required');
}

export const generateToken = (id: string, role: UserRole): string => {
  return jwt.sign({ id, role }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRE ?? '30d'
  } as jwt.SignOptions);
};

export const generateRefreshToken = (id: string, role: UserRole): string => {
  return jwt.sign({ id, role }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRE ?? '90d'
  } as jwt.SignOptions);
};

export interface VerifyTokenResult {
  success: boolean;
  payload?: JwtPayload;
  error?: string;
}

export const verifyToken = (token: string): VerifyTokenResult => {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JwtPayload;

    if (!payload.id || !payload.role) {
      return { success: false, error: 'Invalid token payload' };
    }

    return { success: true, payload };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { success: false, error: 'Token has expired' };
    }
    if (error instanceof JsonWebTokenError) {
      return { success: false, error: 'Invalid token' };
    }
    return { success: false, error: 'Token verification failed' };
  }
};

export const verifyRefreshToken = (token: string): VerifyTokenResult => {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as JwtPayload;

    if (!payload.id || !payload.role) {
      return { success: false, error: 'Invalid token payload' };
    }

    return { success: true, payload };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { success: false, error: 'Token has expired' };
    }
    if (error instanceof JsonWebTokenError) {
      return { success: false, error: 'Invalid token' };
    }
    return { success: false, error: 'Token verification failed' };
  }
};