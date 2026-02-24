import { prisma } from '../prisma';

export class AuditService {
  static async log(
    tenantId: string,
    actorId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string
  ) {
    const auditLog = await prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        entityType,
        entityId,
        action,
        oldValue: oldValue || null,
        newValue: newValue || null,
        ipAddress
      }
    });

    return auditLog;
  }

  static async getAuditLogs(
    tenantId: string,
    filters?: { entityType?: string; entityId?: string; limit?: number; offset?: number }
  ) {
    return prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(filters?.entityType && { entityType: filters.entityType }),
        ...(filters?.entityId && { entityId: filters.entityId })
      },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0
    });
  }

  static async getEntityActivity(tenantId: string, entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { tenantId, entityType, entityId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}
