# GitHub Actions Workflows

## Deploy to CloudFront

Automated deployment pipeline for the resume website with quality gates.

### Workflow: `deploy.yml`

**Triggers:**
- Push to `main` branch (when changes in `apps/my-resume/` or `infra/`)
- Manual dispatch via GitHub UI with branch selection

**Quality Gates:**
1. **Lint Check** - Biome format and lint validation
2. **Test Suite** - Run all tests
3. **Deploy** - Only runs if lint and tests pass

**Steps:**

#### 1. Lint & Format Check
- Runs Biome to check code quality
- Validates formatting and code standards
- Fails pipeline if issues found

#### 2. Run Tests
- Executes test suite with rstest
- Validates component functionality
- Fails pipeline if tests fail

#### 3. Deploy to AWS (if quality gates pass)
- Checkout code from specified branch
- Build React app with environment variables
- Deploy infrastructure with CDK
- Invalidate CloudFront cache
- Post deployment summary

### Required GitHub Secrets

Configure these in your repository settings (`Settings → Secrets and variables → Actions`):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key for deployment | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region for deployment | `us-east-1` |
| `LLM_API_URL` | LLM service URL (optional) | `http://your-server:5000` |

### Setting up AWS Credentials

1. **Create IAM User** with permissions for:
   - CloudFormation (full access)
   - S3 (full access)
   - CloudFront (full access)
   - IAM (limited for CDK)

2. **Generate Access Keys**:
   - Go to IAM → Users → [Your User] → Security credentials
   - Create access key → Application running outside AWS
   - Copy access key ID and secret access key

3. **Add to GitHub Secrets**:
   ```bash
   # Go to your repo
   # Settings → Secrets and variables → Actions → New repository secret
   ```

### Manual Deployment

Deploy any branch to CloudFront:

1. Go to **Actions** tab
2. Select **Deploy to CloudFront** workflow
3. Click **Run workflow**
4. **Select branch** to deploy (e.g., `main`, `dev`, `feature/new-design`)
5. Click **Run workflow**

The workflow will:
- ✅ Run linting checks
- ✅ Run test suite
- ✅ Deploy only if all checks pass
- ✅ Post deployment summary with branch name

### Monitoring

- View deployment logs in the **Actions** tab
- Check CloudFormation stack in AWS Console
- Access website via CloudFront distribution URL

### Local Testing

Before pushing, test quality gates locally:

```bash
cd apps/my-resume

# Install dependencies
npm install

# Run lint check
npx @biomejs/biome check ./src

# Run tests
npm test

# Build
npm run build
```

Test CDK synthesis:
```bash
cd infra
pip install -r requirements.txt
cdk synth  # Test CDK synthesis
```

## Workflow Features

✅ **Lint checks** - Biome format and code quality validation  
✅ **Automated tests** - Full test suite runs before deploy  
✅ **Quality gates** - Deploy only if lint & tests pass  
✅ **Branch deployment** - Deploy any branch manually  
✅ **Automatic deployment** on push to main  
✅ **Cache optimization** for faster builds  
✅ **Environment variables** from secrets  
✅ **CloudFront invalidation** after deploy  
✅ **Deployment summary** with branch and URL  

## CI/CD Pipeline Visualization

```
┌─────────────────┐
│   Push/Manual   │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Lint   │ ← Biome check
    └────┬────┘
         │ Pass
    ┌────▼────┐
    │  Test   │ ← npm test
    └────┬────┘
         │ Pass
    ┌────▼────┐
    │ Deploy  │ ← CDK deploy
    └────┬────┘
         │
    ┌────▼────┐
    │ Success │
    └─────────┘
```

Any failure in lint or test stages will stop the deployment.  
