import { PrismaClient } from './generated/prisma/client/index.js';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
async function main() {
  const user = await prisma.adminUser.findUnique({ where: { email: 'admin@test.com' }, include: { recoveryCodes: true } });
  console.log(JSON.stringify(user, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
