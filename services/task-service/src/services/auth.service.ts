import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { prisma } from '../prisma';
import crypto from 'crypto';
import { isSuperAdminEmail } from '../security/superadmin';

const isProduction = process.env.NODE_ENV === 'production';

const getSecret = (envName: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', fallback: string): string => {
  const value = process.env[envName];

  if (value && value.trim().length >= 32) {
    return value;
  }

  if (isProduction) {
    throw new Error(`${envName} must be set and at least 32 characters in production`);
  }

  return fallback;
};

const JWT_SECRET = getSecret('JWT_SECRET', 'dev-secret-key-change-me-32-characters-min');
const JWT_REFRESH_SECRET = getSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32-chars');
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcryptjs.hash(password, 12);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  // Generate JWT
  static generateAccessToken(userId: string, tenantId: string, email: string, sessionId?: string): string {
    return jwt.sign(
      { userId, tenantId, email, sessionId, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Generate refresh token
  static generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  // Verify JWT
  static verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      throw new Error('Invalid token');
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (e) {
      throw new Error('Invalid refresh token');
    }
  }

  // Register user
  static async register(email: string, displayName: string, password: string, tenantId: string) {
    const existing = await prisma.user.findFirst({
      where: { email, tenantId }
    });

    if (existing) throw new Error('User already exists');

    const passwordHash = await this.hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        displayName,
        passwordHash,
        emailVerification: {
          create: {
            token: verificationToken,
            email,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        }
      },
      include: { tenant: true }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'user_registered'
      }
    });

    return { user, verificationToken };
  }

  // Verify email
  static async verifyEmail(token: string) {
    const verification = await prisma.emailVerification.findUnique({
      where: { token }
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new Error('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerified: true }
    });

    await prisma.emailVerification.delete({ where: { token } });
  }

  // Login
  static async login(email: string, password: string, tenantId: string, ipAddress: string, userAgent: string) {
    let user = await prisma.user.findFirst({
      where: { email, tenantId }
    });

    // Superadmins can authenticate by email even if the supplied tenant id is different.
    if (!user && isSuperAdminEmail(email)) {
      user = await prisma.user.findFirst({
        where: { email }
      });
    }

    if (!user) throw new Error('Invalid credentials');
    if (!user.emailVerified) throw new Error('Email not verified');
    if (!user.passwordHash) throw new Error('Invalid credentials');

    const validPassword = await this.verifyPassword(password, user.passwordHash);
    if (!validPassword) throw new Error('Invalid credentials');

    // Create session
    const refreshToken = this.generateRefreshToken(user.id);
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent
      }
    });

    const accessToken = this.generateAccessToken(user.id, user.tenantId, user.email, session.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'user_login',
        ipAddress
      }
    });

    return { user, accessToken, refreshToken };
  }

  // Refresh token
  static async refreshToken(refreshToken: string) {
    this.verifyRefreshToken(refreshToken);
    const session = await prisma.authSession.findUnique({
      where: { refreshToken },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Session expired');
    }

    const newAccessToken = this.generateAccessToken(
      session.user.id,
      session.user.tenantId,
      session.user.email,
      session.id
    );
    return { accessToken: newAccessToken };
  }

  // Logout (invalidate session)
  static async logout(refreshToken: string) {
    await prisma.authSession.deleteMany({
      where: { refreshToken }
    });
  }

  // Request password reset
  static async requestPasswordReset(email: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { email, tenantId }
    });

    if (!user) return null;

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      update: {
        token,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000)
      },
      create: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000)
      }
    });

    return token;
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string) {
    const reset = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!reset || reset.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, passwordResetRequired: false }
    });

    await prisma.passwordResetToken.delete({ where: { token } });

    await prisma.auditLog.create({
      data: {
        tenantId: reset.user.tenantId,
        actorId: reset.userId,
        entityType: 'User',
        entityId: reset.userId,
        action: 'password_reset'
      }
    });
  }
}
