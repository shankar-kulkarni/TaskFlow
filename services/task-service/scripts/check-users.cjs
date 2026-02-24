const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.user.findMany({
    where: { tenantId: 'tenant-uuid' },
    select: {
      email: true,
      tenantId: true,
      role: true,
      emailVerified: true,
      status: true
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }]
  });
  console.table(rows);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
