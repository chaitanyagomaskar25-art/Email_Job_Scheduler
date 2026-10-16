import { emailWorker } from './workers/email.worker';
import { outboxSweeperService } from './services/outboxSweeper.service';
import { prisma } from './repositories/prisma';
import { logger } from './utils/logger';

async function bootstrapWorker() {
  logger.info('🚀 Starting ReachInbox Standalone BullMQ Worker & Recovery Sweeper...');

  // Start BullMQ Worker
  emailWorker.start();

  // Start Transactional Outbox Sweeper for crash recovery
  outboxSweeperService.start();

  logger.info('✅ Worker process is running and waiting for scheduled jobs.');

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully stopping worker and sweeper...`);

    outboxSweeperService.stop();
    await emailWorker.close();

    try {
      await prisma.$disconnect();
      logger.info('Worker database connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error disconnecting database in worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrapWorker().catch((err) => {
  logger.error({ err }, 'Fatal error during worker process startup');
  process.exit(1);
});

