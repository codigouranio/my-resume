# AWS SES Email Integration Guide

## Overview

The API service now sends emails via AWS SES (Simple Email Service) for:
- ✅ **Signup Confirmation** - Welcome email when users register
- ✅ **Password Change Confirmation** - Email when users change password

## Setup Instructions

### 1. AWS SES Configuration

#### Verify Sender Email in SES
1. Go to AWS Console → SES (Simple Email Service)
2. Ensure your region is set to `us-east-1` (or your preferred region)
3. Go to **Verified Identities**
4. Click **Create Identity**
5. Choose **Email address**
6. Enter your email: `noreply@resumecast.ai` (or your domain email)
7. Check your email inbox and click the verification link
8. Status should show as "Verified"

#### Request Production Access (Optional)
If you want to send to any email address (not just verified ones):
1. In SES Console, click **Account dashboard**
2. Find **Mail sending status**
3. Click **Edit your sending limits**
4. Request production access
5. AWS will review (usually takes 24 hours)

For testing, you can add recipient emails to **Verified Identities** the same way.

#### Create IAM Access Keys
1. Go to AWS Console → IAM
2. Click **Users**
3. Create a new user or use existing
4. Click **Security credentials** tab
5. Create **Access key**
6. Copy:
   - `Access Key ID` → `AWS_ACCESS_KEY_ID`
   - `Secret Access Key` → `AWS_SECRET_ACCESS_KEY`

#### Attach SES Policy to User
1. Go to IAM → Users
2. Select your user
3. Click **Add permissions** → **Attach policies**
4. Search for **AmazonSesSendingAccess**
5. Attach it

Or create a custom policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Local Development Setup

Update `.env` in `apps/api-service/`:

```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
SES_FROM_EMAIL="noreply@resumecast.ai"
FRONTEND_URL="http://localhost:3001"
```

### 3. Production Setup (Ansible)

Update `ansible/inventory.yml`:

```yaml
vars:
  # AWS SES Email Service Configuration
  aws_region: "us-east-1"
  aws_access_key_id: "your-access-key-id"
  aws_secret_access_key: "your-secret-access-key"
  ses_from_email: "noreply@resumecast.ai"
```

Or use Ansible Vault for sensitive data:

```bash
ansible-vault encrypt_string 'your-access-key-id' --name vault_aws_access_key_id
ansible-vault encrypt_string 'your-secret-access-key' --name vault_aws_secret_access_key
```

Add to `ansible/group_vars/all.yml`:

```yaml
aws_access_key_id: "{{ vault_aws_access_key_id }}"
aws_secret_access_key: "{{ vault_aws_secret_access_key }}"
```

### 4. Install Dependencies

The API service already has AWS SDK installed:

```bash
npm install @aws-sdk/client-ses
```

If upgrading existing installation:

```bash
cd apps/api-service
npm install
npm run build
pm2 restart api-service --update-env
```

## API Endpoints

### Signup (Sends Welcome Email)

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Email sent:**
- To: user@example.com
- Subject: "Welcome to ResumeCast!"
- Contains link to dashboard

### Change Password (Sends Confirmation Email)

```bash
POST /api/auth/change-password
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

**Email sent:**
- To: user@example.com
- Subject: "Your Password Has Been Changed"
- Contains security warning and dashboard link

## Email Templates

### Signup Email
```
To: user@example.com
Subject: Welcome to ResumeCast!

Body:
- Welcome message with user's first name
- Confirmation that account was created
- Button to go to dashboard
- Link to FRONTEND_URL/dashboard
```

### Password Change Email
```
To: user@example.com
Subject: Your Password Has Been Changed

Body:
- Confirmation of password change
- Security notice about contacting support if unauthorized
- Button to go to dashboard
- Link to support page
```

## Customization

### Change Email Template

Edit `apps/api-service/src/shared/email/email.service.ts`:

```typescript
async sendSignupEmail(email: string, firstName: string): Promise<void> {
  const subject = 'Custom Subject';
  const htmlBody = `
    <h1>Custom HTML Template</h1>
    <p>Hi ${firstName},</p>
    <!-- Your custom HTML here -->
  `;
  const textBody = `Custom Text Template...`;
  
  await this.sendEmail(email, subject, htmlBody, textBody);
}
```

### Change Sender Email

Update environment variable:
```env
SES_FROM_EMAIL="custom@yourdomain.com"
```

The email must be verified in AWS SES first.

### Add More Triggers

To send emails for other events (e.g., password reset), add methods to `EmailService`:

```typescript
async sendPasswordResetEmail(email: string, firstName: string, resetLink: string): Promise<void> {
  const subject = 'Reset Your Password';
  const htmlBody = `
    <h1>Password Reset Request</h1>
    <p>Hi ${firstName},</p>
    <p><a href="${resetLink}">Click here to reset your password</a></p>
  `;
  // ... send email
}
```

## Testing

### Local Testing

1. Install dependencies:
```bash
cd apps/api-service
npm install
```

2. Update `.env` with AWS credentials:
```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
SES_FROM_EMAIL="noreply@resumecast.ai"
```

3. Start dev server:
```bash
npm run start:dev
```

4. Test signup endpoint:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

5. Check AWS SES console for sent email or check user's inbox

### Production Testing

1. Deploy with Ansible:
```bash
./ansible/deploy_with_conda.sh
```

2. SSH into server:
```bash
ssh jose@172.16.23.127
```

3. Check API logs:
```bash
pm2 logs api-service | grep -i email
```

4. Test via API:
```bash
curl -X POST https://api.resumecast.ai/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test"
  }'
```

## Troubleshooting

### "Email address not verified in SES"
**Solution:** Verify the `SES_FROM_EMAIL` in AWS SES console

### "InvalidParameterValue: Email address does not conform to RFC 2821"
**Solution:** Ensure email format is valid (standard email format)

### "Email sending failed silently"
**Solution:** Check logs for errors:
```bash
pm2 logs api-service | grep -i "failed\|error\|email"
```

### "Access denied" or "InvalidClientTokenId"
**Solution:** 
- Check AWS credentials in `.env`
- Verify IAM user has `AmazonSesSendingAccess` policy
- Check AWS region is correct

### "MessageRejected: Email address is not verified"
**Solution:**
- Verify recipient email in SES (if in sandbox mode)
- Request production access to SES
- Or add recipient to verified identities

## Monitoring

### Check SES Usage

```bash
# SSH to server
ssh jose@172.16.23.127

# Check API service logs for email activity
pm2 logs api-service --lines 100

# Filter for email logs
pm2 logs api-service | grep -i "email\|sent"
```

### AWS SES Console

1. Go to AWS Console → SES
2. Check **Sending statistics**
3. View **Send rate** and bounces
4. Monitor **Account health**

## Security Best Practices

1. **Use Ansible Vault** for storing AWS credentials:
```bash
ansible-vault encrypt_string 'your-secret' --name vault_aws_secret_access_key
```

2. **Limit IAM Permissions**:
```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail"],
  "Resource": "*"
}
```

3. **Monitor Bounce/Complaint Rates**:
- Check AWS SES console regularly
- Monitor for hard bounces and complaints
- Unsubscribe invalid emails

4. **Use Domain Email**:
- Send from your domain email (noreply@resumecast.ai)
- SPF/DKIM records improve deliverability
- Configure in AWS SES

5. **Respect Rate Limits**:
- Default: 14 emails per second
- Request increase if needed
- AWS SES handles backoff automatically

## Cost

- **Free tier:** 62,000 emails per month
- **After free tier:** $0.10 per 1,000 emails
- **No charge for failed sends**

Monitor usage in AWS SES console to stay within limits.

## References

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [SES Sending Limits](https://docs.aws.amazon.com/ses/latest/dg/limits.html)
- [SES Email Authentication](https://docs.aws.amazon.com/ses/latest/dg/email-authentication.html)

---

**Last Updated:** February 3, 2026
**Status:** ✅ Ready for Production
