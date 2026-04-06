import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/adminGuard';

export const adminRouter = Router();

// All admin routes require admin authentication
adminRouter.use(requireAdmin);

// Get dashboard statistics
adminRouter.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalLogins, highRiskLogins, totalDevices] = await Promise.all([
      prisma.user.count(),
      prisma.loginAttempt.count(),
      prisma.loginAttempt.count({ where: { riskLevel: 'high' } }),
      prisma.webAuthnCredential.count(),
    ]);

    const successfulLogins = await prisma.loginAttempt.count({
      where: { success: true },
    });

    const successRate = totalLogins > 0 ? (successfulLogins / totalLogins) * 100 : 0;

    res.json({
      ok: true,
      stats: {
        totalUsers,
        totalLogins,
        highRiskLogins,
        totalDevices,
        successRate: Math.round(successRate),
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get all users
adminRouter.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        credentials: {  // ← Changed from webAuthnCredentials to credentials
          select: { id: true },
        },
        loginAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, success: true, riskLevel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      deviceCount: user.credentials.length,  // ← Changed from webAuthnCredentials to credentials
      lastLogin: user.loginAttempts[0]?.createdAt || null,
      lastLoginSuccess: user.loginAttempts[0]?.success || false,
      lastRiskLevel: user.loginAttempts[0]?.riskLevel || null,
    }));

    res.json({ ok: true, users: formattedUsers });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get all login attempts
adminRouter.get('/logins', async (req, res) => {
  try {
    const logins = await prisma.loginAttempt.findMany({
      include: {
        user: {
          select: { username: true, email: true, isAdmin: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ ok: true, logins });
  } catch (error) {
    console.error('Admin logins error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get high-risk logins only
adminRouter.get('/high-risk', async (req, res) => {
  try {
    const logins = await prisma.loginAttempt.findMany({
      where: { riskLevel: 'high' },
      include: {
        user: {
          select: { username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ ok: true, logins });
  } catch (error) {
    console.error('Admin high-risk error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get all devices
adminRouter.get('/devices', async (req, res) => {
  try {
    const devices = await prisma.webAuthnCredential.findMany({
      include: {
        user: {
          select: { username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedDevices = devices.map(device => ({
      id: device.id,
      deviceName: device.deviceName,
      deviceOS: device.deviceOS,
      lastUsedAt: device.lastUsedAt,
      createdAt: device.createdAt,
      user: device.user,
    }));

    res.json({ ok: true, devices: formattedDevices });
  } catch (error) {
    console.error('Admin devices error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});