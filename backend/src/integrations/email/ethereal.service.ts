import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface SendMailParams {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string | null;
  password?: string | null;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
  response: string;
}

class EmailDeliveryService {
  private static instance: EmailDeliveryService;
  private cachedTransporters: Map<string, Transporter> = new Map();
  private ephemeralTestAccount: nodemailer.TestAccount | null = null;

  private constructor() {}

  public static getInstance(): EmailDeliveryService {
    if (!EmailDeliveryService.instance) {
      EmailDeliveryService.instance = new EmailDeliveryService();
    }
    return EmailDeliveryService.instance;
  }

  private async getEphemeralTestAccount(): Promise<nodemailer.TestAccount> {
    if (!this.ephemeralTestAccount) {
      logger.info('Creating dynamic Ethereal test account...');
      this.ephemeralTestAccount = await nodemailer.createTestAccount();
      logger.info(
        { user: this.ephemeralTestAccount.user },
        'Ethereal test account provisioned for local development'
      );
    }
    return this.ephemeralTestAccount;
  }

  public async getTransporter(params: {
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string | null;
    password?: string | null;
  }): Promise<Transporter> {
    const host = params.host || env.ETHEREAL_HOST;
    const port = params.port || env.ETHEREAL_PORT;
    const secure = params.secure ?? env.ETHEREAL_SECURE;
    let user = params.username || env.ETHEREAL_USER;
    let pass = params.password || env.ETHEREAL_PASS;

    // If no credentials provided, generate or reuse Ethereal test account
    if (!user || !pass) {
      const testAccount = await this.getEphemeralTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
    }

    const cacheKey = `${host}:${port}:${user}`;
    if (this.cachedTransporters.has(cacheKey)) {
      return this.cachedTransporters.get(cacheKey)!;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    this.cachedTransporters.set(cacheKey, transporter);
    return transporter;
  }

  public async sendEmail(params: SendMailParams): Promise<SendMailResult> {
    const transporter = await this.getTransporter({
      host: params.host,
      port: params.port,
      secure: params.secure,
      username: params.username,
      password: params.password,
    });

    const mailOptions = {
      from: `"${params.fromName}" <${params.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.body.replace(/\n/g, '<br/>'),
    };

    const info: SentMessageInfo = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info(
      {
        messageId: info.messageId,
        to: params.to,
        previewUrl: previewUrl || 'N/A',
      },
      'Email successfully delivered via SMTP'
    );

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || false,
      response: info.response,
    };
  }
}

export const emailDeliveryService = EmailDeliveryService.getInstance();
