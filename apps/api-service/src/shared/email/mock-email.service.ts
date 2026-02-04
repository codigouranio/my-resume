import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockEmailService {
  private readonly logger = new Logger(MockEmailService.name);

  async sendSignupEmail(email: string, firstName: string): Promise<void> {
    this.logger.log(`📧 [MOCK] Signup email sent to: ${email}`);
    this.logger.log(`   Subject: Welcome to ResumeCast!`);
    this.logger.log(`   Recipient: ${firstName} <${email}>`);
    this.logger.log(`   Message: Account created successfully`);
  }

  async sendPasswordChangeEmail(email: string, firstName: string): Promise<void> {
    this.logger.log(`📧 [MOCK] Password change email sent to: ${email}`);
    this.logger.log(`   Subject: Your Password Has Been Changed`);
    this.logger.log(`   Recipient: ${firstName} <${email}>`);
  }

  async sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    this.logger.log(`📧 [MOCK] Password reset email sent to: ${email}`);
    this.logger.log(`   Subject: Reset Your Password`);
    this.logger.log(`   Reset link: http://localhost:3001/reset-password?token=${token}`);
    this.logger.log(`   Recipient: ${firstName} <${email}>`);
    this.logger.log(`   ⚠️  Copy the link above to test password reset!`);
  }
}
