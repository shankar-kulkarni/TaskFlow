const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  try {
    const tasks = await prisma.task.findMany({
      where: { tenantId: 'tenant-uuid' },
      include: {
        project: true,
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } },
        creator: true
      },
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 25
    });
    console.log('Tasks:', tasks);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();