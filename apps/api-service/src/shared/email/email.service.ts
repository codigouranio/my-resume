import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient;
  private readonly senderEmail: string;

  constructor(private configService: ConfigService) {
    const awsRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', '');
    const awsSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', '');
    
    this.logger.debug(`[EmailService] Initializing with AWS Region: ${awsRegion}`);
    this.logger.debug(`[EmailService] AWS_ACCESS_KEY_ID present: ${awsAccessKeyId ? 'Yes' : 'No'}`);
    this.logger.debug(`[EmailService] AWS_SECRET_ACCESS_KEY present: ${awsSecretAccessKey ? 'Yes' : 'No'}`);
    
    this.sesClient = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    this.senderEmail = this.configService.get<string>('SES_FROM_EMAIL', 'noreply@resumecast.ai');
    this.logger.debug(`[EmailService] Sender email: ${this.senderEmail}`);
  }

  async sendSignupEmail(email: string, firstName: string): Promise<void> {
    this.logger.debug(`Preparing signup email for ${email} (${firstName})`);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const subject = 'Welcome to ResumeCast!';
    const htmlBody = `
      <h1>Welcome to ResumeCast, ${firstName}!</h1>
      <p>Thank you for signing up. Your account has been successfully created.</p>
      <p>
        <a href="${frontendUrl}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
      </p>
      <p>If you have any questions, feel free to reach out to us.</p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Welcome to ResumeCast, ${firstName}!\n\nThank you for signing up. Your account has been successfully created.\n\nGo to: ${frontendUrl}/dashboard\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendPasswordChangeEmail(email: string, firstName: string): Promise<void> {
    this.logger.debug(`Preparing password change email for ${email} (${firstName})`);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const subject = 'Your Password Has Been Changed';
    const htmlBody = `
      <h1>Password Change Confirmation</h1>
      <p>Hi ${firstName},</p>
      <p>Your password has been successfully changed.</p>
      <p>If you did not request this change, please <a href="${frontendUrl}/support">contact support</a> immediately.</p>
      <p>
        <a href="${frontendUrl}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
      </p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\nYour password has been successfully changed.\n\nIf you did not request this change, please contact support immediately.\n\nGo to: ${frontendUrl}/dashboard\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    this.logger.debug(`Preparing password reset email for ${email} (${firstName})`);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset Your Password';
    const htmlBody = `
      <h1>Password Reset Request</h1>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p>
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p><strong>This link will expire in 1 hour.</strong></p>
      <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\nWe received a request to reset your password.\n\nReset your password by clicking this link:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendSubscriptionUpgradeEmail(email: string, firstName: string): Promise<void> {
    this.logger.debug(`Preparing subscription upgrade email for ${email} (${firstName})`);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const subject = '🎉 Welcome to ResumeCast PRO!';
    const htmlBody = `
      <h1>Welcome to ResumeCast PRO! 🎉</h1>
      <p>Hi ${firstName},</p>
      <p>Congratulations! Your PRO subscription is now active. You now have access to premium features:</p>
      <ul style="font-size: 16px; line-height: 1.8;">
        <li><strong>Custom Subdomain:</strong> Get your own memorable URL like <code>yourname.resumecast.ai</code></li>
        <li><strong>Custom Domain:</strong> Set a fully custom domain for your professional presence</li>
        <li><strong>Advanced Analytics:</strong> Track who views your resume with detailed insights</li>
        <li><strong>Priority Support:</strong> Get help when you need it</li>
      </ul>
      <p>
        <a href="${frontendUrl}/settings" 
           style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Go to Settings
        </a>
      </p>
      <p>Start by setting up your custom subdomain in the settings page!</p>
      <p>Thank you for supporting ResumeCast!</p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\nCongratulations! Your PRO subscription is now active.\n\nYou now have access to premium features:\n\n• Custom Subdomain: Get your own memorable URL\n• Custom Domain: Set a fully custom domain\n• Advanced Analytics: Track resume viewers\n• Priority Support: Get help when you need it\n\nGo to Settings: ${frontendUrl}/settings\n\nThank you for supporting ResumeCast!\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendRecruiterInterestEmail(
    email: string,
    firstName: string,
    recruiterName: string,
    company: string,
    message: string,
    resumeTitle: string,
  ): Promise<void> {
    this.logger.debug(`Preparing recruiter interest email for ${email} (${firstName})`);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai');
    const subject = `🎯 ${recruiterName} from ${company} is interested in your resume!`;
    const htmlBody = `
      <h1>Someone's Interested! 🎯</h1>
      <p>Hi ${firstName},</p>
      <p><strong>${recruiterName}</strong> from <strong>${company}</strong> has shown interest in your resume <strong>"${resumeTitle}"</strong>.</p>
      <p><strong>Their Message:</strong></p>
      <blockquote style="border-left: 4px solid #007BFF; padding-left: 16px; margin: 16px 0; color: #333;">
        ${message.replace(/\n/g, '<br>')}
      </blockquote>
      <p>Check your dashboard to see more details and respond to recruiting opportunities.</p>
      <p>
        <a href="${frontendUrl}/dashboard" 
           style="display: inline-block; padding: 12px 24px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View in Dashboard
        </a>
      </p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\n${recruiterName} from ${company} has shown interest in your resume "${resumeTitle}".\n\nTheir Message:\n${message}\n\nCheck your dashboard for more details.\n\nGo to: ${frontendUrl}/dashboard\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendSubdomainSetEmail(email: string, firstName: string, customDomain: string): Promise<void> {
    this.logger.debug(`Preparing subdomain setup email for ${email} (${firstName})`);
    const baseDomain = this.configService.get<string>('FRONTEND_URL', 'https://resumecast.ai').replace('https://', '').replace('http://', '');
    const subdomainUrl = `https://${customDomain}.${baseDomain}`;
    const subject = '✨ Your Custom Subdomain is Ready!';
    const htmlBody = `
      <h1>Your Custom Subdomain is Ready! ✨</h1>
      <p>Hi ${firstName},</p>
      <p>Great news! Your custom subdomain has been successfully set up.</p>
      <p><strong>Your New URL:</strong></p>
      <p style="font-size: 18px; font-weight: bold; color: #007BFF;">
        <a href="${subdomainUrl}" target="_blank" rel="noopener noreferrer">${customDomain}.${baseDomain}</a>
      </p>
      <p>Share this professional URL with recruiters, on your LinkedIn profile, and anywhere you want to showcase your work.</p>
      <p>You can update your default resume or manage your subdomains anytime in your settings.</p>
      <p>
        <a href="${subdomainUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Your Subdomain
        </a>
      </p>
      <p>Best regards,<br>ResumeCast Team</p>
    `;

    const textBody = `Hi ${firstName},\n\nGreat news! Your custom subdomain has been successfully set up.\n\nYour New URL: ${subdomainUrl}\n\nShare this professional URL with recruiters and on your LinkedIn profile.\n\nBest regards,\nResumeCast Team`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  private async sendEmail(
    recipient: string,
    subject: string,
    htmlBody: string,
    textBody: string,
  ): Promise<void> {
    try {
      this.logger.debug(`[EmailService] Starting email send to ${recipient} with subject: "${subject}"`);
      this.logger.debug(`[EmailService] Using SES sender: ${this.senderEmail}`);
      
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

      this.logger.debug(`[EmailService] Sending email command via SES...`);
      const response = await this.sesClient.send(command);
      this.logger.log(`[EmailService] ✓ Email successfully sent to ${recipient}. MessageId: ${response.MessageId}`);
    } catch (error) {
      this.logger.error(`[EmailService] ✗ Failed to send email to ${recipient}: ${error.message}`, error.stack);
      // Don't throw - email service failure shouldn't block user signup/password change
    }
  }
}
