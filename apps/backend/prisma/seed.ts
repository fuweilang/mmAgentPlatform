import { PrismaClient, TenantType, MemberRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = '12345678';

async function upsertUser(phone: string, name: string, isPlatformAdmin = false) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { phone },
    update: { passwordHash, name, isPlatformAdmin },
    create: { phone, name, passwordHash, isPlatformAdmin },
  });
}

async function main() {
  const platform = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: { name: '猛犸总部', slug: 'platform', type: TenantType.PLATFORM },
  });
  const agency = await prisma.tenant.upsert({
    where: { slug: 'demo-agency' },
    update: {},
    create: { name: '演示代理商', slug: 'demo-agency', type: TenantType.AGENCY },
  });
  const enterprise = await prisma.tenant.upsert({
    where: { slug: 'demo-enterprise' },
    update: {},
    create: { name: '演示企业', slug: 'demo-enterprise', type: TenantType.ENTERPRISE },
  });

  await prisma.orgTree.upsert({
    where: { parentId_childId: { parentId: platform.id, childId: agency.id } },
    update: {},
    create: { parentId: platform.id, childId: agency.id },
  });
  await prisma.orgTree.upsert({
    where: { parentId_childId: { parentId: agency.id, childId: enterprise.id } },
    update: {},
    create: { parentId: agency.id, childId: enterprise.id },
  });

  const admin = await upsertUser('13800000001', '平台超管', true);
  const agencyUser = await upsertUser('13800000002', '代理商管理员');
  const demoUser = await upsertUser('13800000003', '企业员工');

  await prisma.orgMember.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: platform.id } },
    update: {},
    create: { userId: admin.id, tenantId: platform.id, role: MemberRole.OWNER },
  });
  await prisma.orgMember.upsert({
    where: { userId_tenantId: { userId: agencyUser.id, tenantId: agency.id } },
    update: {},
    create: { userId: agencyUser.id, tenantId: agency.id, role: MemberRole.OWNER },
  });
  await prisma.orgMember.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: enterprise.id } },
    update: {},
    create: { userId: demoUser.id, tenantId: enterprise.id, role: MemberRole.MEMBER },
  });

  console.log('seed ok');
  console.log('  13800000001 / 12345678  (平台超管)');
  console.log('  13800000002 / 12345678  (代理商)');
  console.log('  13800000003 / 12345678  (企业)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
