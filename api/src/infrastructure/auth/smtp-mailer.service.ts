import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class SmtpMailerService {
  constructor(private readonly config: ConfigService) {}

  async sendEmailChangeVerification(
    recipient: string,
    verificationUrl: string,
  ): Promise<void> {
    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    const from = this.config.get<string>('smtp.from');

    if (!host || !user || !pass || !from) {
      throw new ServiceUnavailableException(
        'Email verification is not configured. Contact support.',
      );
    }

    const port = this.config.get<number>('smtp.port', 587);
    const secure = this.config.get<boolean>('smtp.secure', false);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    try {
      await transport.sendMail({
        from,
        to: recipient,
        subject: 'Confirm your new Daily Hisab email address',
        text: [
          'You requested to change the email address for your Daily Hisab account.',
          '',
          'Confirm the change by opening this link within 30 minutes:',
          verificationUrl,
          '',
          'If you did not request this change, you can ignore this email.',
        ].join('\n'),
        html: `<p>You requested to change the email address for your Daily Hisab account.</p><p><a href="${verificationUrl}">Confirm your new email address</a></p><p>This link expires in 30 minutes. If you did not request this change, you can safely ignore this email.</p>`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'We could not send the verification email. Try again later.',
      );
    }
  }
}
