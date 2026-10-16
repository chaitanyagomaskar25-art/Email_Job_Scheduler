import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './repositories/prisma';
import { elasticsearchService } from './integrations/elasticsearch/elasticsearch.service';

async function bootstrap() {
  const app = createApp();

  // Test and initialize Elasticsearch index if reachable
  elasticsearchService.ensureIndex().catch((err) => {
    logger.warn({ err: err.message }, 'Initial Elasticsearch connection check deferred');
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 ReachInbox API Server running on port ${env.PORT}`);
    logger.info(`📖 OpenAPI Documentation: http://localhost:${env.PORT}/api-docs`);
    logger.info(`📊 BullMQ Dashboard: http://localhost:${env.PORT}/admin/queues`);
    logger.info(`🌐 Frontend Target: ${env.FRONTEND_URL}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down API server gracefully...`);

    server.close(async () => {
      try {
        await prisma.$disconnect();
        logger.info('PostgreSQL connection closed.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during database disconnection');
        process.exit(1);
      }
    });

    // Force exit if hanging
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during server startup');
  process.exit(1);
});

