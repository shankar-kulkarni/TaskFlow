import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { prisma } from '../prisma';
import { isSuperAdminEmail } from '../security/superadmin';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', async (req: any, res) => {
  try {
    const { email, displayName, password, password_confirm, tenant_id } = req.body;

    if (!email || !displayName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== password_confirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { user, verificationToken } = await AuthService.register(
      email,
      displayName,
      password,
      tenant_id || 'tenant-default'
    );

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    await EmailService.sendEmailVerification(email, displayName, verificationUrl, user.id);

    res.json({
      message: 'Registration successful. Please check your email to verify.',
      user: { id: user.id, email: user.email, displayName: user.displayName }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req: any, res) => {
  try {
    const { token } = req.body;
    await AuthService.verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: any, res) => {
  try {
    const { email, password, tenant_id } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const { user, accessToken, refreshToken } = await AuthService.login(
      email,
      password,
      tenant_id || 'tenant-default',
      ipAddress,
      userAgent
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordResetRequired: user.passwordResetRequired,
        isSuperAdmin: isSuperAdminEmail(user.email),
      },
      tenantId: user.tenantId,
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: any, res) => {
  try {
    const { refreshToken } = req.body;
    const { accessToken } = await AuthService.refreshToken(refreshToken);
    res.json({ accessToken });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req: any, res) => {
  try {
    const { refreshToken } = req.body;
    await AuthService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req: any, res) => {
  try {
    const { email, tenant_id } = req.body;
    const tenantId = tenant_id || 'tenant-default';
    const token = await AuthService.requestPasswordReset(email, tenantId);

    if (token) {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      const user = await prisma.user.findFirst({ where: { email, tenantId } });
      if (user) {
        await EmailService.sendPasswordResetEmail(email, user.displayName, resetUrl, user.id);
      }
    }

    res.json({ message: 'If an account matches that email, a reset link has been sent.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req: any, res) => {
  try {
    const { token, newPassword, newPassword_confirm } = req.body;

    if (newPassword !== newPassword_confirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    await AuthService.resetPassword(token, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
