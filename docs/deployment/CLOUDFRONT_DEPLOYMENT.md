# CloudFront Deployment Automation

This directory contains automated deployment scripts for deploying the frontend to AWS CloudFront.

## 🚀 Quick Start

### Local Deployment

```bash
# Make script executable
chmod +x deploy-cloudfront.sh

# Run deployment
./deploy-cloudfront.sh
```

The script will:
1. ✅ Update environment variables
2. ✅ Build frontend
3. ✅ Deploy to CloudFront via CDK
4. ✅ Invalidate cache
5. ✅ Show deployment URLs

### GitHub Actions Deployment

The deployment automatically triggers on:
- Push to `main` branch (when frontend or infra files change)
- Manual workflow dispatch

#### Setup GitHub Secrets

1. **AWS Credentials** - Use OIDC (recommended) or access keys

**Option A: OIDC (Recommended)**
```bash
# Required secret:
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
```

**Option B: Access Keys**
```yaml
# Required secrets:
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

2. **API Domain**
```bash
# Required secret:
API_DOMAIN=api.yourdomain.com
```

#### Setup AWS IAM Role (for OIDC)

Create IAM role with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "cloudfront:*",
        "iam:*",
        "lambda:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Trust policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/my-resume:*"
        }
      }
    }
  ]
}
```

#### Manual Workflow Trigger

1. Go to **Actions** tab
2. Select **Deploy to CloudFront**
3. Click **Run workflow**
4. Enter API domain
5. Click **Run workflow**

## 📋 Prerequisites

### AWS Setup
```bash
# Install AWS CLI
brew install awscli  # macOS
# or
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region: us-east-1
# - Default output format: json
```

### CDK Setup
```bash
# Install AWS CDK
npm install -g aws-cdk

# Verify installation
cdk --version

# Bootstrap CDK (first time only)
cd infra
cdk bootstrap
```

### Python Dependencies
```bash
cd infra
pip install -r requirements.txt
```

## 🔧 Configuration

### Environment Variables

The deployment script automatically creates this file:

**apps/my-resume/.env.production:**
```bash
PUBLIC_API_URL=https://api.yourdomain.com/api
PUBLIC_LLM_API_URL=https://api.yourdomain.com/llm
```

### CDK Context

**infra/cdk.json:**
```json
{
  "app": "python3 app.py",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

## 📊 What Gets Deployed

```
AWS Resources Created:
├── S3 Bucket
│   ├── Versioning: Disabled
│   ├── Encryption: S3 Managed
│   └── Public Access: Blocked
│
├── CloudFront Distribution
│   ├── Price Class: US, Canada, Europe
│   ├── SSL: Automatic
│   ├── Caching: Optimized
│   └── Error Pages: SPA routing
│
└── CloudFront OAI
    └── Grants CloudFront access to S3
```

## 💰 Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| S3 Storage (1GB) | $0.02 |
| S3 Requests | $0.01 |
| CloudFront (50GB transfer) | $4.25 |
| CloudFront Requests (1M) | $0.75 |
| **Total** | **~$5-10/month** |

## 🧪 Testing

### Test CloudFront Deployment
```bash
# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name MyResumeCloudFrontStack \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text)

# Test frontend
curl -I https://$CLOUDFRONT_URL

# Open in browser
open https://$CLOUDFRONT_URL
```

### Test with Custom Domain
```bash
# After configuring Cloudflare DNS
curl -I https://yourdomain.com
open https://yourdomain.com
```

## 🔄 Update/Redeploy

```bash
# Just run the script again
./deploy-cloudfront.sh

# Or manually
cd apps/my-resume
npm run build
cd ../../infra
cdk deploy
```

## 🗑️ Cleanup/Destroy

```bash
cd infra
cdk destroy

# This will delete:
# - CloudFront distribution
# - S3 bucket (and all files)
# - CloudFormation stack
```

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
cd apps/my-resume
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### CDK Deploy Fails
```bash
# Check AWS credentials
aws sts get-caller-identity

# Re-bootstrap if needed
cd infra
cdk bootstrap --force

# Check stack status
aws cloudformation describe-stacks --stack-name MyResumeCloudFrontStack
```

### Cache Not Invalidating
```bash
# Manual invalidation
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name MyResumeCloudFrontStack \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --id <INVALIDATION_ID>
```

### Permission Errors
```bash
# Check IAM permissions
aws iam get-user

# You need these permissions:
# - cloudformation:*
# - s3:*
# - cloudfront:*
# - iam:PassRole
```

## 📚 Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [GitHub Actions AWS](https://github.com/aws-actions)
- [Cloudflare DNS](https://www.cloudflare.com/dns/)

## 🔗 Related Documentation

- [MINIMAL_AWS_DEPLOYMENT.md](../MINIMAL_AWS_DEPLOYMENT.md) - Full deployment guide
- [HYBRID_CLOUD_DEPLOYMENT.md](../HYBRID_CLOUD_DEPLOYMENT.md) - Hybrid architecture
- [home-gpu-setup/](../home-gpu-setup/) - Home server setup
