import { Client } from '@elastic/elasticsearch';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface EmailDocument {
  id: string;
  userId: string;
  senderId: string;
  senderEmail?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export interface SearchEmailParams {
  userId: string;
  query: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface SearchEmailResult {
  total: number;
  page: number;
  limit: number;
  emails: EmailDocument[];
}

class ElasticsearchService {
  private client: Client;
  private isIndexInitialized = false;

  constructor() {
    this.client = new Client({
      node: env.ELASTICSEARCH_NODE,
      maxRetries: 3,
      requestTimeout: 10000,
    });
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  public async ensureIndex(): Promise<void> {
    if (this.isIndexInitialized) return;

    try {
      const exists = await this.client.indices.exists({ index: env.ELASTICSEARCH_INDEX });
      if (!exists) {
        logger.info(`Creating Elasticsearch index: ${env.ELASTICSEARCH_INDEX}`);
        await this.client.indices.create({
          index: env.ELASTICSEARCH_INDEX,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' }, // Mandatory tenant isolation
                senderId: { type: 'keyword' },
                senderEmail: { type: 'keyword' },
                recipientEmail: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                subject: {
                  type: 'text',
                  fields: { keyword: { type: 'keyword' } },
                },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        logger.info(`Elasticsearch index ${env.ELASTICSEARCH_INDEX} created successfully`);
      }
      this.isIndexInitialized = true;
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Elasticsearch index initialization skipped or failed');
    }
  }

  public async indexEmail(doc: EmailDocument): Promise<boolean> {
    try {
      await this.ensureIndex();
      await this.client.index({
        index: env.ELASTICSEARCH_INDEX,
        id: doc.id,
        body: doc,
        refresh: 'wait_for',
      });
      return true;
    } catch (error: any) {
      logger.warn(
        { emailId: doc.id, error: error.message },
        'Failed to index email in Elasticsearch (PostgreSQL remains authoritative)'
      );
      return false;
    }
  }

  public async searchEmails(params: SearchEmailParams): Promise<SearchEmailResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const from = (page - 1) * limit;

    const mustFilters: any[] = [
      { term: { userId: params.userId } }, // Enforce tenant isolation strictly
    ];

    if (params.status && params.status !== 'ALL') {
      mustFilters.push({ term: { status: params.status } });
    }

    try {
      const response = await this.client.search({
        index: env.ELASTICSEARCH_INDEX,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              filter: mustFilters,
              must: [
                {
                  multi_match: {
                    query: params.query,
                    fields: ['recipientEmail^3', 'subject^2', 'body', 'senderEmail'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        },
      });

      const totalValue =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const emails: EmailDocument[] = response.hits.hits.map((hit: any) => hit._source);

      return {
        total: totalValue,
        page,
        limit,
        emails,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Elasticsearch search query failed');
      throw error;
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
