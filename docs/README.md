# Documentation Index

Welcome to the My Resume project documentation! This directory contains all project documentation organized by category.

## 📂 Directory Structure

### 🏗️ [Architecture](./architecture/)
System design and architectural decisions:
- [Cloud Deployment Architecture](./architecture/CLOUD_DEPLOYMENT_ARCHITECTURE.md)
- [Event-Driven LLM Architecture](./architecture/EVENT_DRIVEN_LLM_ARCHITECTURE.md)
- [Company Enrichment Architecture](./architecture/COMPANY_ENRICHMENT_ARCHITECTURE.md)
- [Hybrid Cloud Deployment](./architecture/HYBRID_CLOUD_DEPLOYMENT.md)

### 🚀 [Deployment](./deployment/)
Deployment guides and infrastructure:
- [GCP Deployment Complexity Analysis](./deployment/GCP_DEPLOYMENT_COMPLEXITY_ANALYSIS.md)
- [Minimal AWS Deployment](./deployment/MINIMAL_AWS_DEPLOYMENT.md)
- [VLLM Deployment Complete](./deployment/VLLM_DEPLOYMENT_COMPLETE.md)
- [CloudFront Deployment](./deployment/CLOUDFRONT_DEPLOYMENT.md)
- [Ansible Configuration Changes](./deployment/ANSIBLE_CONFIG_CHANGES.md)
- [Ansible Quick Reference](./deployment/ANSIBLE_QUICK_REF.md)
- [Ansible Update Summary](./deployment/ANSIBLE_UPDATE_SUMMARY.md)
- [Ansible Verification](./deployment/ANSIBLE_VERIFICATION.md)
- [Health Check Guide](./deployment/HEALTH_CHECK.md)
- [Health Check Quick Reference](./deployment/HEALTH_CHECK_QUICK.md)
- [Publishing Binaries](./deployment/PUBLISHING_BINARIES.md)
- [Search Deployment](./deployment/SEARCH_DEPLOYMENT.md)

### ✨ [Features](./features/)
Feature-specific documentation:
- [Recruiter Interest Feature](./features/RECRUITER_INTEREST_FEATURE.md)
- [Recruiter Interest Implementation](./features/RECRUITER_INTEREST_IMPLEMENTATION.md)
- [Recruiter Interest README](./features/RECRUITER_INTEREST_README.md)
- [Recruiter Interest Quickstart](./features/RECRUITER_INTEREST_QUICKSTART.md)
- [Recruiter Interest Email Template](./features/RECRUITER_INTEREST_EMAIL_TEMPLATE.md)
- [Stripe Integration](./features/STRIPE_INTEGRATION.md)
- [Position Fit Scoring](./features/POSITION_FIT_SCORING.md)
- [Chat Analytics Summary](./features/CHAT_ANALYTICS_SUMMARY.md)
- [BullMQ + LangChain Setup](./features/BULLMQ_LANGCHAIN_SETUP.md)
- [Company Enrichment Flow](./features/COMPANY_ENRICHMENT_FLOW.md)
- [Company Name Normalization](./features/COMPANY_NAME_NORMALIZATION.md)
- [Company Info Troubleshooting](./features/COMPANY_INFO_TROUBLESHOOTING.md)
- [Pino Logging](./features/PINO_LOGGING.md)

### 📖 [Guides](./guides/)
How-to guides and tutorials:
- [Service Interactions Guide](./guides/SERVICE_INTERACTIONS.md) ⭐
- [JWT Authentication Guide](./guides/JWT_AUTH_GUIDE.md)
- [LLM API Key Guide](./guides/LLM_API_KEY_GUIDE.md)
- [Secrets Management](./guides/SECRETS_MANAGEMENT.md)
- [Ansible Vault API Keys Quickstart](./guides/ANSIBLE_VAULT_API_KEYS_QUICKSTART.md)
- [How to Access Analytics](./guides/HOW_TO_ACCESS_ANALYTICS.md)

### ⚙️ [Setup](./setup/)
Initial setup and configuration:
- [AWS SES Setup](./setup/AWS_SES_SETUP.md)
- [AWS SES Implementation](./setup/AWS_SES_IMPLEMENTATION.md)
- [AWS SES Code Reference](./setup/AWS_SES_CODE_REFERENCE.md)
- [SPF, DKIM, DMARC Setup](./setup/SPF_DKIM_DMARC_SETUP.md)
- [LinkedIn Import Setup](./setup/LINKEDIN_IMPORT_SETUP.md)

### 🔨 [Implementation](./implementation/)
Implementation details and changelogs:
- [Webhook Implementation Complete](./implementation/WEBHOOK_IMPLEMENTATION_COMPLETE.md)
- [Webhook Quickstart](./implementation/WEBHOOK_QUICKSTART.md)
- [API Key Implementation Summary](./implementation/API_KEY_IMPLEMENTATION_SUMMARY.md)
- [JWT Implementation Complete](./implementation/JWT_IMPLEMENTATION_COMPLETE.md)
- [LLM Webhook Implementation](./implementation/LLM_WEBHOOK_IMPLEMENTATION.md)
- [LLM Service Refactoring](./implementation/LLM_SERVICE_REFACTORING.md)
- [Phase 1 Complete](./implementation/PHASE_1_COMPLETE.md)
- [Phase 2 Complete](./implementation/PHASE_2_COMPLETE.md)
- [Phase 3 Complete](./implementation/PHASE_3_COMPLETE.md)
- [Phase 4 Complete](./implementation/PHASE_4_COMPLETE.md)
- [Completion Summary](./implementation/COMPLETION_SUMMARY.md)

### 🧪 [Testing](./testing/)
Test reports and quality assurance:
- [Test Report](./testing/TEST_REPORT.md)
- [Test Success](./testing/TEST_SUCCESS.md)
- [Testing File Attachments](./testing/TESTING_FILE_ATTACHMENTS.md)
- [Fix File Upload Error](./testing/FIX_FILE_UPLOAD_ERROR.md)

## 🎯 Quick Links

### Getting Started
1. Start with the main [README.md](../README.md) in the repository root
2. Review [Service Interactions Guide](./guides/SERVICE_INTERACTIONS.md) for authentication setup
3. Follow [Ansible Vault API Keys Quickstart](./guides/ANSIBLE_VAULT_API_KEYS_QUICKSTART.md) for secrets

### For Development
- [Service Interactions Guide](./guides/SERVICE_INTERACTIONS.md) - Authentication between services
- [JWT Authentication Guide](./guides/JWT_AUTH_GUIDE.md) - JWT setup details
- [LLM API Key Guide](./guides/LLM_API_KEY_GUIDE.md) - API key authentication

### For Deployment
- [GCP Deployment Analysis](./deployment/GCP_DEPLOYMENT_COMPLEXITY_ANALYSIS.md) - Google Cloud deployment
- [Minimal AWS Deployment](./deployment/MINIMAL_AWS_DEPLOYMENT.md) - AWS deployment
- [Ansible Quick Reference](./deployment/ANSIBLE_QUICK_REF.md) - Ansible commands
- [Health Check Guide](./deployment/HEALTH_CHECK.md) - Service health monitoring

### For Operations
- [Secrets Management](./guides/SECRETS_MANAGEMENT.md) - Managing credentials
- [How to Access Analytics](./guides/HOW_TO_ACCESS_ANALYTICS.md) - Analytics dashboard
- [Pino Logging](./features/PINO_LOGGING.md) - Logging system

## 📝 Contributing to Documentation

When adding new documentation:

1. **Choose the right directory:**
   - `architecture/` - Design decisions, system diagrams
   - `deployment/` - Infrastructure, deployment guides
   - `features/` - Feature-specific documentation
   - `guides/` - How-to guides, tutorials
   - `setup/` - Initial configuration, setup steps
   - `implementation/` - Implementation details, changelogs
   - `testing/` - Test reports, QA documentation

2. **Follow naming conventions:**
   - Use SCREAMING_SNAKE_CASE for consistency
   - Be descriptive: `JWT_AUTH_GUIDE.md` not `auth.md`
   - Add dates to time-sensitive docs: `MIGRATION_2026.md`

3. **Update this index** when adding new documentation

4. **Link between documents** using relative paths:
   ```markdown
   See [JWT Auth Guide](../guides/JWT_AUTH_GUIDE.md)
   ```

## 🔍 Search Tips

Use GitHub's search or your editor's search to find documentation:

```bash
# Find all references to a topic
grep -r "JWT authentication" docs/

# List all docs in a category
ls docs/guides/

# Search for specific term
find docs/ -name "*STRIPE*"
```

---

**Last Updated:** March 13, 2026  
**Maintained By:** Project Team
