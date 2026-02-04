import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient;
  private readonly senderEmail: string;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.senderEmail = process.env.SES_FROM_EMAIL || 'noreply@resumecast.ai';
  }

  async sendSignupEmail(email: string, firstName: string): Promise<void> {
    const subject = 'Welcome to ResumeCast!';
    const htmlBody = `
      <h1>Welcome to ResumeCast, ${firstName}!</h1>
      <p>Thank you for signing up. Your account has been successfully created.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'https://resumecast.ai'}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
      </p>
      <p>If you have any questions, feel free to reach out to us.</p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Welcome to ResumeCast, ${firstName}!\n\nThank you for signing up. Your account has been successfully created.\n\nGo to: ${process.env.FRONTEND_URL || 'https://resumecast.ai'}/dashboard\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendPasswordChangeEmail(email: string, firstName: string): Promise<void> {
    const subject = 'Your Password Has Been Changed';
    const htmlBody = `
      <h1>Password Change Confirmation</h1>
      <p>Hi ${firstName},</p>
      <p>Your password has been successfully changed.</p>
      <p>If you did not request this change, please <a href="${process.env.FRONTEND_URL || 'https://resumecast.ai'}/support">contact support</a> immediately.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'https://resumecast.ai'}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
      </p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\nYour password has been successfully changed.\n\nIf you did not request this change, please contact support immediately.\n\nGo to: ${process.env.FRONTEND_URL || 'https://resumecast.ai'}/dashboard\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  private async sendEmail(
    recipient: string,
    subject: string,
    htmlBody: string,
    textBody: string,
  ): Promise<void> {
    try {
      const command = new SendEmailCommand({
        Source: this.senderEmail,
        Destination: {
          ToAddresses: [recipient],
        },
        Message: {
          Subject: {
            Data: subject,
          },
          Body: {
            Html: {
              Data: htmlBody,
            },
            Text: {
              Data: textBody,
            },
          },
        },
      });

      const response = await this.sesClient.send(command);
      this.logger.log(`Email sent to ${recipient}. MessageId: ${response.MessageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipient}:`, error);
      // Don't throw - email service failure shouldn't block user signup/password change
    }
  }
}
