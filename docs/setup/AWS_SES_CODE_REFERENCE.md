# AWS SES Integration - Code Reference

## Files Created

### 1. Email Service
**Path:** `apps/api-service/src/shared/email/email.service.ts`

```typescript
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
```

### 2. Email Module
**Path:** `apps/api-service/src/shared/email/email.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

### 3. Change Password DTO
**Path:** `apps/api-service/src/features/auth/dto/change-password.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({ example: 'newPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
```

## Files Modified

### 4. Auth Service
**Path:** `apps/api-service/src/features/auth/auth.service.ts`

**Key Changes:**
```typescript
// Added imports
import { BadRequestException } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from '../../shared/email/email.service';

// Constructor updated
constructor(
  private usersService: UsersService,
  private jwtService: JwtService,
  private prisma: PrismaService,
  private emailService: EmailService, // NEW
) {}

// Modified register method
async register(registerDto: RegisterDto) {
  const hashedPassword = await bcrypt.hash(registerDto.password, 10);
  const user = await this.usersService.create({
    ...registerDto,
    password: hashedPassword,
  });

  // Send signup welcome email (non-blocking)
  this.emailService.sendSignupEmail(user.email, user.firstName || 'User').catch((err) => {
    console.error('Failed to send signup email:', err);
  });

  return this.login(user);
}

// New method
async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
  // Get user with password
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
  if (!isPasswordValid) {
    throw new BadRequestException('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

  // Update password
  await this.prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Send password change confirmation email (non-blocking)
  this.emailService.sendPasswordChangeEmail(user.email, user.firstName || 'User').catch((err) => {
    console.error('Failed to send password change email:', err);
  });

  return { message: 'Password changed successfully' };
}
```

### 5. Auth Controller
**Path:** `apps/api-service/src/features/auth/auth.controller.ts`

**Key Changes:**
```typescript
// Updated imports
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';

// New endpoint added
@UseGuards(JwtAuthGuard)
@Post('change-password')
@ApiBearerAuth()
@ApiOperation({ summary: 'Change user password' })
@ApiResponse({ status: 200, description: 'Password changed successfully' })
@ApiResponse({ status: 400, description: 'Invalid current password' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
async changePassword(
  @CurrentUser() user: any,
  @Body() changePasswordDto: ChangePasswordDto,
) {
  return this.authService.changePassword(user.id, changePasswordDto);
}
```

### 6. Auth Module
**Path:** `apps/api-service/src/features/auth/auth.module.ts`

**Key Changes:**
```typescript
// Added import
import { EmailModule } from '../../shared/email/email.module';

// Updated imports array
@Module({
  imports: [
    UsersModule,
    EmailModule,  // NEW
    PassportModule,
    // ... rest unchanged
  ],
  // ... rest unchanged
})
```

### 7. Package.json Dependencies
**Path:** `apps/api-service/package.json`

**Added dependency:**
```json
"@aws-sdk/client-ses": "^3.500.0"
```

### 8. Environment Variables
**Path:** `apps/api-service/.env`

**Added variables:**
```env
# AWS SES - Email Service
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-here"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key-here"
SES_FROM_EMAIL="noreply@resumecast.ai"
FRONTEND_URL="http://localhost:3001"
```

### 9. Ansible Configuration Updates

**ansible/group_vars/all.yml:**
```yaml
# AWS SES Email Service Configuration
aws_region: "{{ vault_aws_region | default('us-east-1') }}"
aws_access_key_id: "{{ vault_aws_access_key_id | default('') }}"
aws_secret_access_key: "{{ vault_aws_secret_access_key | default('') }}"
ses_from_email: "{{ vault_ses_from_email | default('noreply@resumecast.ai') }}"
```

**ansible/inventory.yml:**
```yaml
# AWS SES Email Service Configuration (Change these values!)
aws_region: "us-east-1"
aws_access_key_id: "CHANGE_ME_YOUR_AWS_ACCESS_KEY"
aws_secret_access_key: "CHANGE_ME_YOUR_AWS_SECRET_KEY"
ses_from_email: "noreply@resumecast.ai"
```

**ansible/playbooks/03-application-deploy.yml:**
```yaml
- name: Configure API Service environment
  copy:
    dest: "{{ api_service_path }}/.env"
    content: |
      # ... existing vars ...
      AWS_REGION={{ aws_region | default('us-east-1') }}
      AWS_ACCESS_KEY_ID={{ aws_access_key_id | default('') }}
      AWS_SECRET_ACCESS_KEY={{ aws_secret_access_key | default('') }}
      SES_FROM_EMAIL={{ ses_from_email | default('noreply@resumecast.ai') }}
      FRONTEND_URL=https://{{ domain }}
```

---

## Testing

### Local Development
```bash
# 1. Install dependencies
cd apps/api-service
npm install

# 2. Update .env with AWS credentials

# 3. Run dev server
npm run start:dev

# 4. Test signup endpoint
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test"
  }'

# 5. Check logs
# Should see: "Email sent to test@example.com"
```

### Production
```bash
# Deploy
./ansible/deploy_with_conda.sh

# Check logs
pm2 logs api-service | grep email

# Test
curl -X POST https://api.resumecast.ai/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test"
  }'
```

---

**Implementation Date:** February 3, 2026
**AWS SDK Version:** ^3.500.0
**Status:** ✅ Complete
