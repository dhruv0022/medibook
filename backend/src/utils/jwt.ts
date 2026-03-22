import jwt from 'jsonwebtoken';
import { UserRole } from '../types';

interface JwtPayload {
  id: string;
  role: UserRole;
}

export const generateToken = (id: string, role: UserRole): string => {
  return jwt.sign(
    { id, role } as JwtPayload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    }
  );
};

export const generateRefreshToken = (id: string, role: UserRole): string => {
  return jwt.sign(
    { id, role } as JwtPayload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '90d',
    }
  );
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
};