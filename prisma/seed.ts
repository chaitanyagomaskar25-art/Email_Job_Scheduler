import { PrismaClient, EmailStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create or upsert a default demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.test' },
    update: {},
    create: {
      email: 'demo@reachinbox.test',
      name: 'ReachInbox Demo User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      googleId: 'demo-google-user-id-12345',
    },
  });

  console.log(`✅ Demo User ready: ${demoUser.email} (${demoUser.id})`);

  // 2. Create or upsert a default EmailSender
  const defaultSender = await prisma.emailSender.upsert({
    where: { id: 'default-sender-uuid' },
    update: {
      userId: demoUser.id,
    },
    create: {
      id: 'default-sender-uuid',
      userId: demoUser.id,
      name: 'Primary Outreach Account',
      email: 'outreach@reachinbox.test',
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      username: process.env.ETHEREAL_USER || null,
      password: process.env.ETHEREAL_PASS || null,
      isDefault: true,
    },
  });

  console.log(`✅ Default Sender ready: ${defaultSender.name} <${defaultSender.email}>`);

  // 3. Seed some initial sample scheduled emails for testing dashboard views
  const existingCount = await prisma.scheduledEmail.count({
    where: { userId: demoUser.id },
  });

  if (existingCount === 0) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    await prisma.scheduledEmail.createMany({
      data: [
        {
          userId: demoUser.id,
          senderId: defaultSender.id,
          recipientEmail: 'alex.candidate@reachinbox.test',
          subject: 'Welcome to ReachInbox Email Outreach Platform',
          body: 'Hello Alex,\n\nWe are excited to have you evaluate our email job scheduler platform.\n\nBest regards,\nReachInbox Team',
          scheduledAt: futureDate,
          nextEligibleAt: futureDate,
          status: EmailStatus.SCHEDULED,
        },
        {
          userId: demoUser.id,
          senderId: defaultSender.id,
          recipientEmail: 'sam.developer@reachinbox.test',
          subject: 'Technical Architecture Deep Dive',
          body: 'Hi Sam,\n\nHere is the documentation regarding our BullMQ delayed job scheduler and distributed rate limiter.\n\nCheers,\nEngineering',
          scheduledAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          nextEligibleAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          status: EmailStatus.SCHEDULED,
        },
      ],
    });
    console.log('✅ Seeded initial scheduled emails.');
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

