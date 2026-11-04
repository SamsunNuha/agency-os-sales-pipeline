/**
 * Prisma seed script
 * Creates demo data: agency, users, pipelines, stages, clients, deals, follow-ups.
 *
 * Safe to re-run — uses upsert/skipDuplicates where possible.
 * Run with: npm run seed  (or: npx ts-node prisma/seed.ts)
 */

import 'dotenv/config';
import { PrismaClient, DealState, ActivityType, FollowUpStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed…');

  const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  // ── Agency ────────────────────────────────────────────────
  const agency = await prisma.agency.upsert({
    where: { slug: 'neirah-tech' },
    update: {},
    create: {
      name: 'Neirah Tech Digital Agency',
      slug: 'neirah-tech',
      isActive: true,
    },
  });
  console.log(`  ✅ Agency: ${agency.name}`);

  // ── Roles ─────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { agencyId_name: { agencyId: agency.id, name: 'ADMIN' } },
    update: {},
    create: {
      agencyId: agency.id,
      name: 'ADMIN',
      permissions: ['deals:*', 'pipelines:*', 'follow-ups:*', 'dashboard:read', 'handoff:create'],
    },
  });

  const salesRole = await prisma.role.upsert({
    where: { agencyId_name: { agencyId: agency.id, name: 'SALES' } },
    update: {},
    create: {
      agencyId: agency.id,
      name: 'SALES',
      permissions: ['deals:read', 'deals:create', 'deals:update', 'follow-ups:*', 'dashboard:read'],
    },
  });
  console.log('  ✅ Roles: ADMIN, SALES');

  // ── Users ─────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@agency-os.local';
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      agencyId: agency.id,
      email: adminEmail,
      passwordHash,
      firstName: 'admin',
      lastName: 'User',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@agency-os.local' },
    update: {},
    create: {
      agencyId: agency.id,
      email: 'sales@agency-os.local',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Sales',
    },
  });
  console.log('  ✅ Users: admin, sales');

  // Assign roles
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: salesUser.id, roleId: salesRole.id } },
    update: {},
    create: { userId: salesUser.id, roleId: salesRole.id },
  });

  // ── Clients ───────────────────────────────────────────────
  const clientData = [
    { name: 'Acme Corporation', email: 'contact@acme.com', company: 'Acme Corp', phone: '+1-555-0100' },
    { name: 'Beta Limited', email: 'hello@betalimited.io', company: 'Beta Ltd', phone: '+1-555-0101' },
    { name: 'Gamma Industries', email: 'info@gammaindustries.co', company: 'Gamma Inc', phone: '+1-555-0102' },
    { name: 'Delta Ventures', email: 'team@deltaventures.com', company: 'Delta Ventures', phone: '+1-555-0103' },
    { name: 'Epsilon Media', email: 'hi@epsilonmedia.com', company: 'Epsilon Media', phone: '+1-555-0104' },
  ];

  const clients: Array<{ id: string; name: string; email: string | null }> = [];
  for (const c of clientData) {
    const existing = await prisma.client.findFirst({ where: { agencyId: agency.id, email: c.email } });
    if (existing) {
      clients.push(existing);
    } else {
      const created = await prisma.client.create({ data: { agencyId: agency.id, ...c } });
      clients.push(created);
    }
  }
  console.log(`  ✅ Clients: ${clients.length}`);

  // ── Pipeline 1: Software Services ────────────────────────
  let pipeline1 = await prisma.salesPipeline.findFirst({
    where: { agencyId: agency.id, name: 'Software Services' },
    include: { stages: true },
  });
  if (!pipeline1) {
    pipeline1 = await prisma.salesPipeline.create({
      data: {
        agencyId: agency.id,
        name: 'Software Services',
        description: 'Custom software, web and mobile development deals',
        isDefault: true,
      },
      include: { stages: true },
    });
  }

  // Ensure stages exist
  const sw_stages = [
    { name: 'Lead', slug: 'lead', order: 1, probability: 10, color: '#6B7280' },
    { name: 'Qualified', slug: 'qualified', order: 2, probability: 25, color: '#3B82F6' },
    { name: 'Proposal Sent', slug: 'proposal-sent', order: 3, probability: 50, color: '#8B5CF6' },
    { name: 'Negotiation', slug: 'negotiation', order: 4, probability: 75, color: '#F59E0B' },
    { name: 'Won', slug: 'won', order: 5, probability: 100, color: '#10B981', isWon: true },
    { name: 'Lost', slug: 'lost', order: 6, probability: 0, color: '#EF4444', isLost: true },
  ];

  const p1stages: Array<{ id: string; name: string; slug: string; order: number; isWon: boolean; isLost: boolean }> = [];
  for (const s of sw_stages) {
    const existing = pipeline1.stages.find((st) => st.slug === s.slug);
    if (existing) {
      p1stages.push(existing);
    } else {
      const created = await prisma.pipelineStage.create({
        data: { pipelineId: pipeline1.id, agencyId: agency.id, ...s, isWon: s.isWon || false, isLost: s.isLost || false },
      });
      p1stages.push(created);
    }
  }
  console.log(`  ✅ Pipeline 1 stages: ${p1stages.length}`);

  // ── Pipeline 2: Digital Marketing ────────────────────────
  let pipeline2 = await prisma.salesPipeline.findFirst({
    where: { agencyId: agency.id, name: 'Digital Marketing' },
    include: { stages: true },
  });
  if (!pipeline2) {
    pipeline2 = await prisma.salesPipeline.create({
      data: {
        agencyId: agency.id,
        name: 'Digital Marketing',
        description: 'SEO, social media, PPC and content marketing deals',
      },
      include: { stages: true },
    });
  }

  const dm_stages = [
    { name: 'Discovery', slug: 'discovery', order: 1, probability: 15, color: '#6B7280' },
    { name: 'Strategy', slug: 'strategy', order: 2, probability: 30, color: '#3B82F6' },
    { name: 'Proposal', slug: 'proposal', order: 3, probability: 55, color: '#8B5CF6' },
    { name: 'Closed Won', slug: 'closed-won', order: 4, probability: 100, color: '#10B981', isWon: true },
    { name: 'Closed Lost', slug: 'closed-lost', order: 5, probability: 0, color: '#EF4444', isLost: true },
  ];

  const p2stages: Array<{ id: string; name: string; slug: string; order: number; isWon: boolean; isLost: boolean }> = [];
  for (const s of dm_stages) {
    const existing = pipeline2.stages.find((st) => st.slug === s.slug);
    if (existing) {
      p2stages.push(existing);
    } else {
      const created = await prisma.pipelineStage.create({
        data: { pipelineId: pipeline2.id, agencyId: agency.id, ...s, isWon: s.isWon || false, isLost: s.isLost || false },
      });
      p2stages.push(created);
    }
  }
  console.log(`  ✅ Pipeline 2 stages: ${p2stages.length}`);

  // ── Deals ─────────────────────────────────────────────────
  const dealSeeds = [
    {
      title: 'E-commerce Platform Rebuild',
      clientIdx: 0,
      pipelineStages: p1stages,
      stageSlug: 'negotiation',
      serviceCategory: 'Web Development',
      expectedValue: 48000,
      currency: 'USD',
      ownerId: adminUser.id,
      // future date
      expectedCloseDate: new Date('2027-03-31'),
      state: DealState.ACTIVE,
      notes: 'Client needs full Shopify → custom Next.js migration.',
      tags: ['ecommerce', 'nextjs', 'priority'],
    },
    {
      title: 'Mobile App — Fitness Tracker',
      clientIdx: 1,
      pipelineStages: p1stages,
      stageSlug: 'proposal-sent',
      serviceCategory: 'Mobile Development',
      expectedValue: 32000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-04-15'),
      state: DealState.ACTIVE,
      notes: 'React Native, iOS + Android. Proposal v2 sent.',
      tags: ['mobile', 'react-native'],
    },
    {
      title: 'SEO Growth Package — 12 Months',
      clientIdx: 2,
      pipelineStages: p2stages,
      stageSlug: 'proposal',
      serviceCategory: 'SEO',
      expectedValue: 18000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-02-28'),
      state: DealState.ACTIVE,
      notes: 'Annual retainer. Competitor analysis complete.',
      tags: ['seo', 'retainer'],
    },
    {
      title: 'CRM Integration & Automation',
      clientIdx: 3,
      pipelineStages: p1stages,
      stageSlug: 'won',
      serviceCategory: 'Backend Development',
      expectedValue: 22500,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2025-01-31'),
      state: DealState.WON,
      wonAt: new Date('2025-01-20'),
      notes: 'HubSpot + Zapier + custom webhook integrations.',
      tags: ['crm', 'automation'],
    },
    {
      title: 'Social Media Content Campaign',
      clientIdx: 4,
      pipelineStages: p2stages,
      stageSlug: 'closed-lost',
      serviceCategory: 'Social Media',
      expectedValue: 9600,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2025-01-15'),
      state: DealState.LOST,
      lostAt: new Date('2025-01-10'),
      lostReason: 'Budget constraints',
      lostNote: 'Client went with in-house team due to budget cuts.',
      notes: 'Lost to internal team reshuffle.',
      tags: ['social', 'content'],
    },
    {
      title: 'Brand Identity & Design System',
      clientIdx: 0,
      pipelineStages: p1stages,
      stageSlug: 'qualified',
      serviceCategory: 'Design',
      expectedValue: 15000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2027-05-01'),
      state: DealState.ACTIVE,
      notes: 'Full rebrand including logo, guidelines and component library.',
      tags: ['design', 'branding'],
    },
    // Overdue active deal to demonstrate stalled/overdue handling
    {
      title: 'Legacy System Migration',
      clientIdx: 1,
      pipelineStages: p1stages,
      stageSlug: 'lead',
      serviceCategory: 'Backend Development',
      expectedValue: 20000,
      currency: 'USD',
      ownerId: salesUser.id,
      // Past date (overdue)
      expectedCloseDate: new Date('2026-10-01'),
      state: DealState.ACTIVE,
      notes: 'Client has overdue migration, likely stalled.',
      tags: ['legacy', 'migration'],
    },
    // Additional deals to guarantee minimum 2 deals per stage
    {
      title: 'Enterprise Cloud Portal',
      clientIdx: 2,
      pipelineStages: p1stages,
      stageSlug: 'lead',
      serviceCategory: 'Cloud Services',
      expectedValue: 45000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2027-02-15'),
      state: DealState.ACTIVE,
      notes: 'Multi-cloud enterprise client portal.',
      tags: ['cloud', 'enterprise'],
    },
    {
      title: 'FinTech Banking API Suite',
      clientIdx: 3,
      pipelineStages: p1stages,
      stageSlug: 'qualified',
      serviceCategory: 'Backend Development',
      expectedValue: 65000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-03-01'),
      state: DealState.ACTIVE,
      notes: 'PCI-compliant payment orchestration API.',
      tags: ['fintech', 'api'],
    },
    {
      title: 'NextGen E-Commerce Core',
      clientIdx: 4,
      pipelineStages: p1stages,
      stageSlug: 'proposal-sent',
      serviceCategory: 'Web Development',
      expectedValue: 85000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2027-03-15'),
      state: DealState.ACTIVE,
      notes: 'Headless storefront with high concurrency.',
      tags: ['ecommerce', 'headless'],
    },
    {
      title: 'Strategic Logistics AI Engine',
      clientIdx: 0,
      pipelineStages: p1stages,
      stageSlug: 'negotiation',
      serviceCategory: 'AI & Automation',
      expectedValue: 110000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-03-25'),
      state: DealState.ACTIVE,
      notes: 'Route optimization & fleet dispatch engine.',
      tags: ['ai', 'logistics'],
    },
    {
      title: 'Global Media Streaming Hub',
      clientIdx: 1,
      pipelineStages: p1stages,
      stageSlug: 'won',
      serviceCategory: 'Mobile Development',
      expectedValue: 130000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2026-10-20'),
      state: DealState.WON,
      wonAt: new Date('2026-10-18'),
      notes: 'OTT Video streaming application for Smart TV & Mobile.',
      tags: ['streaming', 'won'],
    },
    {
      title: 'Omni Retail POS Migration',
      clientIdx: 2,
      pipelineStages: p1stages,
      stageSlug: 'lost',
      serviceCategory: 'Backend Development',
      expectedValue: 35000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2026-09-15'),
      state: DealState.LOST,
      lostAt: new Date('2026-09-10'),
      lostReason: 'Client postponed budget',
      notes: 'Decided to renew existing POS.',
      tags: ['pos', 'lost'],
    },
    {
      title: 'Vertex Health Telemed App',
      clientIdx: 3,
      pipelineStages: p1stages,
      stageSlug: 'lost',
      serviceCategory: 'Mobile Development',
      expectedValue: 50000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2026-08-30'),
      state: DealState.LOST,
      lostAt: new Date('2026-08-25'),
      lostReason: 'Regulatory delays',
      notes: 'HIPAA certification delayed project.',
      tags: ['telemed', 'lost'],
    },
    // Pipeline 2 (Digital Marketing) minimum 2 per stage
    {
      title: 'Inbound SEO Growth Retainer',
      clientIdx: 4,
      pipelineStages: p2stages,
      stageSlug: 'discovery',
      serviceCategory: 'SEO',
      expectedValue: 24000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-02-10'),
      state: DealState.ACTIVE,
      notes: 'Initial keyword & competitor discovery.',
      tags: ['seo', 'inbound'],
    },
    {
      title: 'Social Viral Media Campaign',
      clientIdx: 0,
      pipelineStages: p2stages,
      stageSlug: 'discovery',
      serviceCategory: 'Social Media',
      expectedValue: 18000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2027-02-18'),
      state: DealState.ACTIVE,
      notes: 'TikTok and Instagram Reels campaign.',
      tags: ['social', 'viral'],
    },
    {
      title: 'PPC Performance Ad Funnel',
      clientIdx: 1,
      pipelineStages: p2stages,
      stageSlug: 'strategy',
      serviceCategory: 'Digital Marketing',
      expectedValue: 30000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-02-28'),
      state: DealState.ACTIVE,
      notes: 'Google Ads & LinkedIn ABM strategy.',
      tags: ['ppc', 'abm'],
    },
    {
      title: 'Influencer Marketing Sprint',
      clientIdx: 2,
      pipelineStages: p2stages,
      stageSlug: 'strategy',
      serviceCategory: 'Social Media',
      expectedValue: 22000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2027-03-05'),
      state: DealState.ACTIVE,
      notes: 'Macro & micro influencer outreach strategy.',
      tags: ['influencer', 'strategy'],
    },
    {
      title: 'Annual Content & Growth Strategy',
      clientIdx: 3,
      pipelineStages: p2stages,
      stageSlug: 'proposal',
      serviceCategory: 'SEO',
      expectedValue: 42000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2027-03-20'),
      state: DealState.ACTIVE,
      notes: 'Thought leadership and organic traffic engine.',
      tags: ['content', 'growth'],
    },
    {
      title: 'Search Dominance 360 Retainer',
      clientIdx: 4,
      pipelineStages: p2stages,
      stageSlug: 'closed-won',
      serviceCategory: 'SEO',
      expectedValue: 58000,
      currency: 'USD',
      ownerId: adminUser.id,
      expectedCloseDate: new Date('2026-10-15'),
      state: DealState.WON,
      wonAt: new Date('2026-10-12'),
      notes: 'Global multi-lingual search engine domination.',
      tags: ['seo', 'won'],
    },
    {
      title: 'Full Funnel Growth Engine',
      clientIdx: 0,
      pipelineStages: p2stages,
      stageSlug: 'closed-won',
      serviceCategory: 'Digital Marketing',
      expectedValue: 48000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2026-10-22'),
      state: DealState.WON,
      wonAt: new Date('2026-10-19'),
      notes: 'Integrated growth marketing and funnel optimization.',
      tags: ['growth', 'won'],
    },
    {
      title: 'Local Business Ads Trial',
      clientIdx: 1,
      pipelineStages: p2stages,
      stageSlug: 'closed-lost',
      serviceCategory: 'Digital Marketing',
      expectedValue: 8000,
      currency: 'USD',
      ownerId: salesUser.id,
      expectedCloseDate: new Date('2026-09-01'),
      state: DealState.LOST,
      lostAt: new Date('2026-08-28'),
      lostReason: 'Budget too small',
      notes: 'Client had sub-$1k/mo spend expectation.',
      tags: ['local', 'lost'],
    },
  ];

  let dealsCreated = 0;
  for (const d of dealSeeds) {
    const existing = await prisma.deal.findFirst({
      where: { agencyId: agency.id, title: d.title },
    });
    if (existing) continue;

    const targetStage = d.pipelineStages.find((s) => s.slug === d.stageSlug) || d.pipelineStages[0];
    const pipelineId =
      d.pipelineStages === p1stages ? pipeline1!.id : pipeline2!.id;

    const deal = await prisma.deal.create({
      data: {
        agencyId: agency.id,
        clientId: clients[d.clientIdx].id,
        title: d.title,
        serviceCategory: d.serviceCategory,
        expectedValue: d.expectedValue,
        currency: d.currency,
        ownerId: d.ownerId,
        pipelineId,
        stageId: targetStage.id,
        expectedCloseDate: d.expectedCloseDate,
        state: d.state,
        notes: d.notes,
        tags: d.tags,
        wonAt: (d as any).wonAt,
        lostAt: (d as any).lostAt,
        lostReason: (d as any).lostReason,
        lostNote: (d as any).lostNote,
      },
    });

    // Stage history entry
    await prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        agencyId: agency.id,
        fromStageId: null,
        toStageId: targetStage.id,
        movedById: adminUser.id,
        note: 'Deal created (seed)',
      },
    });

    // Activity
    await prisma.dealActivity.create({
      data: {
        dealId: deal.id,
        agencyId: agency.id,
        activityType: ActivityType.DEAL_CREATED,
        description: `Deal "${deal.title}" was created (seed data)`,
        performedById: adminUser.id,
      },
    });

    // Intelligence
    await prisma.dealIntelligence.create({
      data: {
        dealId: deal.id,
        agencyId: agency.id,
        calculatedProbability: targetStage.isWon ? 100 : targetStage.isLost ? 0 : 50,
        lastActivityAt: new Date(),
      },
    });

    dealsCreated++;
  }
  console.log(`  ✅ Deals seeded: ${dealsCreated} new (skipped existing)`);

  // ── Follow-ups ────────────────────────────────────────────
  const activeDeals = await prisma.deal.findMany({
    where: { agencyId: agency.id, state: DealState.ACTIVE },
    take: 3,
  });

  let fuCreated = 0;
  for (const deal of activeDeals) {
    const existingFu = await prisma.dealFollowUp.findFirst({ where: { dealId: deal.id } });
    if (existingFu) continue;
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 3);
    await prisma.dealFollowUp.create({
      data: {
        dealId: deal.id,
        agencyId: agency.id,
        scheduledAt: scheduledDate,
        note: 'Check in on proposal status and answer any questions.',
        status: FollowUpStatus.UPCOMING,
        createdById: adminUser.id,
      },
    });
    fuCreated++;
  }
  console.log(`  ✅ Follow-ups seeded: ${fuCreated}`);

  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('  Demo login credentials:');
  console.log(`  Admin → ${adminEmail} / ${seedPassword}`);
  console.log(`  Sales → sales@agency-os.local / ${seedPassword}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
