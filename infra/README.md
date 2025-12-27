# AWS CDK Infrastructure for React Resume App

This directory contains the AWS CDK infrastructure code to deploy your React application to AWS CloudFront with S3 hosting.

## 📁 Project Structure

```
infra/
├── app.py                    # CDK app entry point
├── cdk.json                  # CDK configuration
├── requirements.txt          # Python dependencies
├── deploy.sh                 # Deployment script (CDK)
├── deploy_boto3.py          # Alternative deployment script (boto3)
├── invalidate_cache.py      # CloudFront cache invalidation script
└── stacks/
    ├── __init__.py
    └── cloudfront_stack.py   # Main CloudFront + S3 stack
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ (or Conda)
- Node.js 18+ (for building React app)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed: `npm install -g aws-cdk`

### Option 1: Deploy with CDK (Recommended)

1. **Make deployment script executable:**
   ```bash
   chmod +x deploy.sh
   ```

2. **Run deployment:**
   
   **Using venv (default):**
   ```bash
   ./deploy.sh
   ```
   
   **Using Conda:**
   ```bash
   USE_CONDA=true ./deploy.sh
   ```

   This script will:
   - Create a Python environment (venv or conda)
   - Install dependencies
   - Build your React app
   - Bootstrap CDK (if needed)
   - Deploy the infrastructure

### Option 2: Deploy with boto3 (Alternative)

If you prefer not to use CDK:

1. **Update configuration in `deploy_boto3.py`:**
   ```python
   BUCKET_NAME = "your-unique-bucket-name"
   REGION = "us-east-1"
   ```

2. **Build your React app:**
   ```bash
   cd ../app
   npm install
   npm run build
   cd ../infra
   ```

3. **Run the deployment script:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install boto3
   python deploy_boto3.py
   ```

### Manual CDK Commands

**Using venv:**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Bootstrap CDK (first time only, per AWS account/region)
cdk bootstrap

# Synthesize CloudFormation template
cdk synth

# Deploy the stack
cdk deploy

# Destroy the stack
cdk destroy
```

**Using Conda:**
```bash
# Create conda environment
conda env create -f environment.yml

# Activate environment
conda activate my-resume-infra

# Bootstrap CDK (first time only, per AWS account/region)
cdk bootstrap

# Synthesize CloudFormation template
cdk synth

# Deploy the stack
cdk deploy

# Update dependencies (when needed)
conda env update -f environment.yml --prune

# Destroy the stack
cdk destroy
```

## 🏗️ Architecture

The infrastructure creates:

1. **S3 Bucket**: Stores static website files
   - Private bucket with encryption
   - Versioning enabled
   - Access via CloudFront only

2. **CloudFront Distribution**: CDN for global content delivery
   - HTTPS redirect enabled
   - Gzip compression
   - SPA routing (404/403 → index.html)
   - Origin Access Identity for S3 access
   - Cache optimization

3. **Automatic Deployment**: S3 deployment with cache invalidation

## 🔧 Configuration

### Custom Domain

To use a custom domain, uncomment and configure in `cloudfront_stack.py`:

```python
domain_names=["resume.yourdomain.com"],
certificate=acm.Certificate.from_certificate_arn(
    self,
    "Certificate",
    "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
)
```

**Note**: Certificate must be in `us-east-1` for CloudFront.

### Removal Policy

For production, change in `cloudfront_stack.py`:

```python
removal_policy=RemovalPolicy.RETAIN,
auto_delete_objects=False,
```

## 📤 Updating Your Website

After initial deployment:

```bash
# Build your React app
cd ../app
npm run build
cd ../infra

# Redeploy (will upload new files and invalidate cache)
cdk deploy
```

Or use the cache invalidation script for faster updates:

```bash
python invalidate_cache.py
```

## 💰 Cost Estimation

AWS Free Tier includes:
- **S3**: 5GB storage, 20,000 GET requests
- **CloudFront**: 1TB data transfer out, 10M HTTP/HTTPS requests
- **Lambda@Edge**: Not used in this setup

Typical monthly cost (beyond free tier): $1-5 for a low-traffic personal website.

## 🔐 Security

- S3 bucket is private (not publicly accessible)
- CloudFront uses Origin Access Identity (OAI)
- HTTPS enforced via redirect
- S3 bucket encryption enabled

## 📊 Outputs

After deployment, you'll see:

- **BucketName**: S3 bucket name
- **DistributionId**: CloudFront distribution ID
- **DistributionDomainName**: CloudFront domain (e.g., d123456.cloudfront.net)
- **WebsiteURL**: Full HTTPS URL to your website

## 🐛 Troubleshooting

### CDK Bootstrap Error
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Build Directory Not Found
Ensure React app is built:
```bash
cd ../app && npm run build
```

### Permission Denied
Check AWS credentials:
```bash
aws sts get-caller-identity
```

### CloudFront Takes Time
CloudFront distributions take 15-20 minutes to fully deploy. Be patient!

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/s3/website/)
