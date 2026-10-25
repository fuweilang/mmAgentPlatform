import { AccessScope, KbStatus, PrismaClient, TenantType, MemberRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { DEFAULT_AGENT_PERSONA, LEGAL_AGENT_PERSONA } from '../src/agent/personas';
import { chunkText, embedText, vectorLiteral } from '../src/knowledge/index-text';
import { uploadRoot } from '../src/knowledge/storage';

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
  const owner = await upsertUser('13800000004', '企业管理员');
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
    where: { userId_tenantId: { userId: owner.id, tenantId: enterprise.id } },
    update: { role: MemberRole.OWNER },
    create: { userId: owner.id, tenantId: enterprise.id, role: MemberRole.OWNER },
  });
  await prisma.orgMember.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: enterprise.id } },
    update: {},
    create: { userId: demoUser.id, tenantId: enterprise.id, role: MemberRole.MEMBER },
  });

  const legal = await ensureAgent(enterprise.id, '法律顾问', LEGAL_AGENT_PERSONA);
  await ensureAgent(enterprise.id, '企业助手', DEFAULT_AGENT_PERSONA);
  await prisma.tenant.update({
    where: { id: enterprise.id },
    data: {
      welcomeMessage: '欢迎使用演示企业控制台。知识库已接入对话检索，请先点材料生效。',
      defaultAgentId: legal.id,
    },
  });
  const folders: Record<string, string> = {};
  for (const name of ['法规', '合同范本', '客户名单']) {
    folders[name] = (await ensureFolder(enterprise.id, name)).id;
  }
  for (const tenant of [platform, agency, enterprise]) {
    await prisma.quota.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: { tenantId: tenant.id, monthlyTurns: 1000, monthlyTokens: 0 },
    });
  }
  await ensureSampleDoc(enterprise.id, folders['法规']);

  console.log('seed ok');
  console.log('  13800000001 / 12345678  (平台超管)');
  console.log('  13800000002 / 12345678  (代理商)');
  console.log('  13800000004 / 12345678  (企业管理员)');
  console.log('  13800000003 / 12345678  (企业员工)');
}

async function ensureAgent(tenantId: string, name: string, persona: string) {
  const existing = await prisma.agentRef.findFirst({ where: { tenantId, name } });
  if (existing) {
    await prisma.agentRef.update({
      where: { id: existing.id },
      data: { persona, enabled: true, visibility: AccessScope.ALL },
    });
    return existing;
  }
  return prisma.agentRef.create({
    data: { tenantId, name, persona, enabled: true, visibility: AccessScope.ALL },
  });
}

async function ensureFolder(tenantId: string, name: string) {
  const existing = await prisma.kbFolder.findFirst({ where: { tenantId, name } });
  if (existing) return existing;
  return prisma.kbFolder.create({ data: { tenantId, name } });
}

const SAMPLE_LABOR_LAW = `劳动合同试用期要点
1. 劳动合同期限三个月以上不满一年的，试用期不得超过一个月。
2. 劳动合同期限一年以上不满三年的，试用期不得超过二个月。
3. 三年以上固定期限和无固定期限的劳动合同，试用期不得超过六个月。
4. 同一用人单位与同一劳动者只能约定一次试用期。
5. 试用期包含在劳动合同期限内。劳动合同仅约定试用期的，试用期不成立，该期限为劳动合同期限。
以上摘录仅供本企业知识库演示检索，回答时必须引用本材料，不得编造法条编号或胜诉结论。
`;

async function ensureSampleDoc(tenantId: string, folderId: string) {
  const name = '劳动合同试用期.txt';
  const existing = await prisma.kbDocument.findFirst({ where: { tenantId, name } });
  if (existing) {
    await indexExisting(existing.id, tenantId, SAMPLE_LABOR_LAW);
    return existing;
  }
  const rel = join(tenantId, 'seed-labor-trial.txt');
  const abs = join(uploadRoot(), rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, SAMPLE_LABOR_LAW, 'utf8');
  const doc = await prisma.kbDocument.create({
    data: {
      tenantId,
      folderId,
      name,
      originalName: name,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(SAMPLE_LABOR_LAW),
      storagePath: rel.replace(/\\/g, '/'),
      status: KbStatus.READY,
      visibility: AccessScope.ALL,
    },
  });
  await indexExisting(doc.id, tenantId, SAMPLE_LABOR_LAW);
  return doc;
}

async function indexExisting(documentId: string, tenantId: string, text: string) {
  await prisma.kbChunk.deleteMany({ where: { documentId } });
  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i += 1) {
    const row = await prisma.kbChunk.create({
      data: { tenantId, documentId, ordinal: i, content: chunks[i] },
    });
    await prisma.$executeRawUnsafe(
      'UPDATE kb_chunk SET embedding = $1::vector WHERE id = $2',
      vectorLiteral(embedText(row.content)),
      row.id,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
