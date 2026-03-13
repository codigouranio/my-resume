# AWS SES Email Integration - Implementation Summary

## ✅ Changes Implemented

### 1. Email Service (New)
**File:** `apps/api-service/src/shared/email/email.service.ts`
- AWS SES integration using `@aws-sdk/client-ses`
- Two email methods:
  - `sendSignupEmail()` - Welcome email on registration
  - `sendPasswordChangeEmail()` - Confirmation on password change
- Non-blocking error handling (email failures don't block user operations)
- HTML and plain text email templates

### 2. Email Module (New)
**File:** `apps/api-service/src/shared/email/email.module.ts`
- Exports `EmailService` for dependency injection
- Available to all feature modules

### 3. Change Password DTO (New)
**File:** `apps/api-service/src/features/auth/dto/change-password.dto.ts`
- Validates current and new password
- Minimum 6 character requirement
- Swagger API documentation

### 4. Auth Service Updates
**File:** `apps/api-service/src/features/auth/auth.service.ts`
- Updated imports: Added `EmailService`, `ChangePasswordDto`, `BadRequestException`
- Enhanced `register()` method: Sends welcome email after signup
- New `changePassword()` method: 
  - Validates current password
  - Hashes new password
  - Updates database
  - Sends confirmation email

### 5. Auth Controller Updates
**File:** `apps/api-service/src/features/auth/auth.controller.ts`
- Updated imports: Added JWT guard, CurrentUser decorator, ChangePasswordDto
- New endpoint: `POST /api/auth/change-password`
  - Requires JWT authentication
  - Validates password with `ChangePasswordDto`
  - Returns success message

### 6. Auth Module Updates
**File:** `apps/api-service/src/features/auth/auth.module.ts`
- Imported `EmailModule`
- EmailService now available to AuthService via dependency injection

### 7. Package Dependencies
**File:** `apps/api-service/package.json`
- Added: `@aws-sdk/client-ses` for AWS email service

### 8. Environment Variables

**Local Dev** (`.env`):
```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-here"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key-here"
SES_FROM_EMAIL="noreply@resumecast.ai"
FRONTEND_URL="http://localhost:3001"
```

**Template** (`.env.example`):
```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id-here"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key-here"
SES_FROM_EMAIL="noreply@resumecast.ai"
FRONTEND_URL="http://localhost:3001"
```

### 9. Ansible Configuration

**Group Variables** (`ansible/group_vars/all.yml`):
```yaml
aws_region: "{{ vault_aws_region | default('us-east-1') }}"
aws_access_key_id: "{{ vault_aws_access_key_id | default('') }}"
aws_secret_access_key: "{{ vault_aws_secret_access_key | default('') }}"
ses_from_email: "{{ vault_ses_from_email | default('noreply@resumecast.ai') }}"
```

**Inventory** (`ansible/inventory.yml`):
```yaml
aws_region: "us-east-1"
aws_access_key_id: "CHANGE_ME_YOUR_AWS_ACCESS_KEY"
aws_secret_access_key: "CHANGE_ME_YOUR_AWS_SECRET_KEY"
ses_from_email: "noreply@resumecast.ai"
```

**Playbook** (`ansible/playbooks/03-application-deploy.yml`):
- API service `.env` now includes AWS SES configuration
- `FRONTEND_URL` automatically set to `https://{{ domain }}`

---

## 🚀 Quick Start

### For Local Development

1. **Get AWS Credentials**
   - AWS Console → IAM
   - Create or use existing user
   - Generate access keys
   - Attach `AmazonSesSendingAccess` policy

2. **Verify Email in SES**
   - AWS Console → SES
   - Add identity: `noreply@resumecast.ai` (or your email)
   - Verify via email link

3. **Update `.env`**
   ```bash
   cd apps/api-service
   # Edit .env with your AWS credentials
   ```

4. **Install & Run**
   ```bash
   npm install
   npm run start:dev
   ```

5. **Test Signup**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123",
       "firstName": "Test"
     }'
   ```

### For Production Deployment

1. **Update Ansible Inventory**
   ```bash
   # Edit ansible/inventory.yml
   aws_access_key_id: "your-actual-key"
   aws_secret_access_key: "your-actual-secret"
   ses_from_email: "noreply@resumecast.ai"
   ```

2. **Deploy**
   ```bash
   ./ansible/deploy_with_conda.sh
   ```

3. **Verify**
   ```bash
   ssh jose@172.16.23.127
   pm2 logs api-service | grep email
   ```

---

## 📧 Email Events

### Signup
- **Trigger:** POST /api/auth/register
- **Email:** Welcome message with dashboard link
- **Template:** HTML + plain text

### Password Change
- **Trigger:** POST /api/auth/change-password
- **Email:** Confirmation with security notice
- **Template:** HTML + plain text

---

## 🔧 API Endpoints

### Register User (Sends Welcome Email)
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Change Password (Sends Confirmation Email)
```
POST /api/auth/change-password
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

---

## 📋 Configuration Checklist

- [ ] AWS Account created
- [ ] SES region set to `us-east-1` (or preferred region)
- [ ] Sender email verified in SES
- [ ] Recipient emails verified in SES (if in sandbox)
- [ ] IAM user created with SES permissions
- [ ] Access keys generated (Access Key ID & Secret)
- [ ] AWS credentials added to `.env`
- [ ] `npm install` ran to get `@aws-sdk/client-ses`
- [ ] Local development tested with signup
- [ ] Ansible inventory updated with AWS credentials
- [ ] Production deployment completed
- [ ] Email received in production environment

---

## 🐛 Troubleshooting

**Email not sending?**
- Check AWS credentials in `.env`
- Verify sender email in SES console
- Check logs: `pm2 logs api-service`

**"Email address not verified"?**
- Go to SES console
- Verify sender email identity
- Check verified identities section

**CORS errors on signup?**
- CORS is already configured for all subdomains
- Check frontend URL in browser console

For more details, see [AWS_SES_SETUP.md](./AWS_SES_SETUP.md)

---

## 📁 Files Modified

| File | Type | Change |
|------|------|--------|
| `apps/api-service/src/shared/email/email.service.ts` | New | Email service implementation |
| `apps/api-service/src/shared/email/email.module.ts` | New | Email module |
| `apps/api-service/src/features/auth/dto/change-password.dto.ts` | New | Password change validation |
| `apps/api-service/src/features/auth/auth.service.ts` | Modified | Email integration |
| `apps/api-service/src/features/auth/auth.controller.ts` | Modified | New change-password endpoint |
| `apps/api-service/src/features/auth/auth.module.ts` | Modified | EmailModule import |
| `apps/api-service/package.json` | Modified | AWS SDK dependency |
| `apps/api-service/.env` | Modified | AWS SES credentials |
| `apps/api-service/.env.example` | Modified | SES config template |
| `ansible/group_vars/all.yml` | Modified | SES variables |
| `ansible/inventory.yml` | Modified | SES configuration |
| `ansible/playbooks/03-application-deploy.yml` | Modified | SES env vars |

---

**Status:** ✅ Complete & Ready for Testing
**Last Updated:** February 3, 2026
