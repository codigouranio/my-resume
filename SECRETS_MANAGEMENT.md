# Storing AWS Secrets Securely

## Overview

You have **3 options** for storing AWS secrets in production:

1. **Ansible Vault** (Recommended) - Encrypt secrets in Git
2. **AWS Secrets Manager** - Store secrets in AWS
3. **Environment Variables** (Development only) - Plain text in .env

---

## Option 1: Ansible Vault (RECOMMENDED for Production)

### What is Ansible Vault?
- Encrypts sensitive data (passwords, API keys) in your Git repository
- Only decryptable with a vault password
- Great for team collaboration and CI/CD

### Step 1: Create Vault Password File

```bash
# Create a secure password file (only you should read it)
echo "your-super-secret-vault-password" > ~/.ansible/vault_password
chmod 600 ~/.ansible/vault_password
```

**Store this password securely** (password manager, 1Password, LastPass, etc.)

### Step 2: Encrypt AWS Secrets

For each secret, run:

```bash
# AWS Access Key ID
ansible-vault encrypt_string 'AKIATIC76MP4...' --name 'vault_aws_access_key_id'

# AWS Secret Access Key
ansible-vault encrypt_string '4pamVw9s8Fcn3...' --name 'vault_aws_secret_access_key'

# AWS Region
ansible-vault encrypt_string 'us-east-1' --name 'vault_aws_region'

# SES From Email
ansible-vault encrypt_string 'noreply@resumecast.ai' --name 'vault_ses_from_email'
```

Each command outputs:
```yaml
vault_aws_access_key_id: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  66386d38656231313537313735656262653861306466356435313438376437306166353839
  3961623362336461663164363933326439643539623264380a...
```

### Step 3: Add to Ansible Inventory

Edit `ansible/inventory-production.yml`:

```yaml
all:
  vars:
    # AWS Secrets (encrypted with ansible-vault)
    vault_aws_access_key_id: !vault |
      $ANSIBLE_VAULT;1.1;AES256
      66386d38656231313537313735656262653861306466356435313438376437306166353839
      3961623362336461663164363933326439643539623264380a...
    
    vault_aws_secret_access_key: !vault |
      $ANSIBLE_VAULT;1.1;AES256
      ...encrypted value...
    
    vault_aws_region: "us-east-1"
    vault_ses_from_email: "noreply@resumecast.ai"
```

### Step 4: Use Vault Variables in Playbook

In `ansible/playbooks/03-application-deploy.yml`:

```yaml
- name: Create API .env file
  blockinfile:
    path: /opt/my-resume/apps/api-service/.env
    block: |
      AWS_REGION="{{ vault_aws_region }}"
      AWS_ACCESS_KEY_ID="{{ vault_aws_access_key_id }}"
      AWS_SECRET_ACCESS_KEY="{{ vault_aws_secret_access_key }}"
      SES_FROM_EMAIL="{{ vault_ses_from_email }}"
```

### Step 5: Deploy with Vault Password

```bash
# Run playbook with vault password
ansible-playbook -i ansible/inventory-production.yml \
  ansible/playbook.yml \
  --vault-password-file ~/.ansible/vault_password

# OR provide password interactively
ansible-playbook -i ansible/inventory-production.yml \
  ansible/playbook.yml \
  --ask-vault-pass
```

### Advantages:
✅ Secrets encrypted in Git  
✅ Team can use same vault password  
✅ Audit trail in Git history  
✅ Works with CI/CD pipelines  

### Disadvantages:
❌ Requires vault password to deploy  
❌ Need to store vault password securely  

---

## Option 2: AWS Secrets Manager

### What is AWS Secrets Manager?
- AWS service to securely store and rotate secrets
- No need to store secrets in Git
- Integrated with IAM for access control

### Step 1: Create Secret in AWS

```bash
aws secretsmanager create-secret \
  --name my-resume/aws-ses \
  --secret-string '{
    "aws_access_key_id": "AKIATIC76MP4...",
    "aws_secret_access_key": "4pamVw9s8Fcn3...",
    "aws_region": "us-east-1",
    "ses_from_email": "noreply@resumecast.ai"
  }' \
  --region us-east-1
```

### Step 2: Retrieve Secret in Application

In `apps/api-service/src/main.ts`:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function loadSecrets() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const command = new GetSecretValueCommand({ SecretId: 'my-resume/aws-ses' });
  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString);
  
  process.env.AWS_ACCESS_KEY_ID = secret.aws_access_key_id;
  process.env.AWS_SECRET_ACCESS_KEY = secret.aws_secret_access_key;
  // etc...
}
```

### Advantages:
✅ No secrets in Git  
✅ Secrets never stored locally  
✅ Can rotate without code changes  
✅ Fine-grained IAM access control  

### Disadvantages:
❌ Additional AWS API calls on startup  
❌ Requires IAM permissions  
❌ More complex setup  

---

## Option 3: Environment Variables (Development Only)

**NOT RECOMMENDED for production** - secrets visible in .env file

Currently using this in `/apps/api-service/.env`:
```env
AWS_ACCESS_KEY_ID=AKIATIC76MP4...
AWS_SECRET_ACCESS_KEY=4pamVw9s8Fcn3...
```

**Never commit .env to Git!** It's in `.gitignore` for a reason.

---

## Recommendation by Environment

| Environment | Method | Why |
|-------------|--------|-----|
| **Development** | `.env` file | Easy to change, local only |
| **Staging** | Ansible Vault | Encrypted, team accessible |
| **Production** | Ansible Vault OR AWS Secrets Manager | Secure, audit trail |

---

## Current Setup (Your Repository)

### Local Development
- ✅ Using `.env` file
- ✅ AWS credentials in plain text (OK for local dev)
- ⚠️ `.env` is in `.gitignore` (not committed)

### Production Deployment
- ⚠️ Currently using plain text in `inventory-production.yml`
- 🔄 **Should migrate to Ansible Vault**

---

## Action Items

### For Production Readiness:

1. **Choose secret storage method** (Ansible Vault recommended)
2. **Encrypt AWS secrets** using Ansible Vault
3. **Update inventory-production.yml** with encrypted values
4. **Create vault_password file** locally
5. **Update deployment scripts** to use `--vault-password-file`

### Quick Setup (Ansible Vault):

```bash
# 1. Create vault password
echo "my-secure-vault-password" > ~/.ansible/vault_password
chmod 600 ~/.ansible/vault_password

# 2. Encrypt AWS Access Key
ansible-vault encrypt_string 'AKIATIC76MP4...' --name 'vault_aws_access_key_id' --vault-password-file ~/.ansible/vault_password

# 3. Encrypt AWS Secret Key
ansible-vault encrypt_string 'your-secret-key' --name 'vault_aws_secret_access_key' --vault-password-file ~/.ansible/vault_password

# 4. Copy encrypted output to ansible/inventory-production.yml

# 5. Deploy with vault
ansible-playbook -i ansible/inventory-production.yml ansible/playbook.yml --vault-password-file ~/.ansible/vault_password
```

---

## Files to Update

1. **ansible/inventory-production.yml** - Add encrypted AWS variables
2. **ansible/playbooks/03-application-deploy.yml** - Use vault variables when creating .env
3. **ansible/deploy.sh** or **update.sh** - Add `--vault-password-file` flag
4. **.gitignore** - Ensure `.env` and vault passwords are ignored

Would you like me to help set up Ansible Vault for your AWS secrets?
