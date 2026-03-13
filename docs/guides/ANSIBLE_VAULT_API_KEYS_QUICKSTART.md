# Adding LLM API Keys to Ansible Vault - Quick Guide

This is a **step-by-step checklist** for adding the new LLM API keys to your Ansible Vault.

## ✅ Step 1: Generate API Keys

```bash
# Generate API key for api-service
openssl rand -hex 32
# Save this output: a1b2c3d4e5f6789...
```

## ✅ Step 2: Encrypt with Ansible Vault

```bash
# For API service (single key)
ansible-vault encrypt_string 'a1b2c3d4e5f6789...' --name 'vault_llm_api_key'
# Copy the entire output starting with "vault_llm_api_key: !vault |"

# For LLM service (JSON with multiple services)
ansible-vault encrypt_string '{"api-service": "a1b2c3d4e5f6789..."}' --name 'vault_llm_authorized_api_keys'
# Copy the entire output starting with "vault_llm_authorized_api_keys: !vault |"
```

**Note:** Both commands will prompt for your vault password (stored in `~/.ansible/vault_password` if configured).

## ✅ Step 3: Add to ansible/inventory-production.yml

Edit `ansible/inventory-production.yml` and replace the placeholder values:

```yaml
all:
  vars:
    # ... existing variables ...
    
    # LLM Service API Key Authentication
    vault_llm_api_key: !vault |
      $ANSIBLE_VAULT;1.1;AES256
      66386d38656231313537313735656262653861306466356435313438376437306166353839
      3961623362336461663164363933326439643539623264380a...
      # ↑ Paste the encrypted output from Step 2 here
    
    vault_llm_authorized_api_keys: !vault |
      $ANSIBLE_VAULT;1.1;AES256
      66386d38656231313537313735656262653861306466356435313438376437306166353839
      3961623362336461663164363933326439643539623264380a...
      # ↑ Paste the encrypted output from Step 2 here
```

**Important:** 
- Remove the line with the variable name (e.g., `vault_llm_api_key: !vault |`)
- Keep the exact indentation from the `ansible-vault encrypt_string` output
- Or manually structure like shown above

## ✅ Step 4: Deploy

The playbook (`ansible/playbooks/03-application-deploy.yml`) is already configured to use these vault variables.

Deploy with:

```bash
# Option 1: With vault password file
ansible-playbook -i ansible/inventory-production.yml \
  ansible/playbooks/03-application-deploy.yml \
  --vault-password-file ~/.ansible/vault_password

# Option 2: Interactive vault password
ansible-playbook -i ansible/inventory-production.yml \
  ansible/playbooks/03-application-deploy.yml \
  --ask-vault-pass

# Option 3: Use deployment script (if it includes vault password)
./ansible/deploy_with_conda.sh
```

## ✅ Step 5: Verify

After deployment, check that the services have the API keys:

```bash
# SSH to production server
ssh user@your-server

# Check API service .env (should show LLM_API_KEY)
cat /opt/my-resume/apps/api-service/.env | grep LLM_API_KEY

# Check LLM service .env (should show LLM_API_KEYS)
cat /opt/my-resume/apps/llm-service/.env | grep LLM_API_KEYS

# Check PM2 logs for authentication messages
pm2 logs llm-service --lines 50 | grep "API key"
# Should see: "✅ API key authentication enabled for X services"

pm2 logs api-service --lines 50 | grep "LLM_API_KEY"
# Should NOT see: "LLM_API_KEY not configured" warning
```

## 🧪 Testing

Test API key authentication:

```bash
# Test without API key (should fail with 401)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "slug": "test"}'

# Expected:
# {"error": "Missing API Key", "message": "X-API-Key header is required"}

# Test with valid API key (should work)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6789..." \
  -d '{"message": "test", "slug": "jose-blanco"}'

# Expected: 200 OK with chat response
```

## 📝 What's Already Configured

The following files have **already been updated** for you:

- ✅ `ansible/inventory-production.yml` - Vault variable placeholders added
- ✅ `ansible/playbooks/03-application-deploy.yml` - Uses vault variables in .env files
- ✅ `ecosystem.config.js` - PM2 config updated with API key environment variables
- ✅ `SECRETS_MANAGEMENT.md` - Updated with API key encryption instructions
- ✅ All API service modules - Send API key in requests
- ✅ LLM service - Validates API keys on all endpoints

**You only need to:**
1. Generate keys
2. Encrypt them
3. Add to `inventory-production.yml`
4. Deploy

## 🔐 Security Notes

- **Never commit unencrypted API keys** - Always use Ansible Vault
- **Store vault password securely** - Use password manager
- **Rotate keys periodically** - Generate new keys, encrypt, update inventory, redeploy
- **One key per service** - If multiple services call LLM service, give each their own key in the JSON

## 🆘 Troubleshooting

### "ERROR! Decryption failed"
- **Cause:** Wrong vault password
- **Solution:** Check `~/.ansible/vault_password` or enter correct password

### "vault_llm_api_key is undefined"
- **Cause:** Variable not in inventory file
- **Solution:** Add encrypted value to `inventory-production.yml`

### "LLM_API_KEY not configured" warning in logs
- **Cause:** API service didn't receive the key from deployment
- **Solution:** Check `.env` file on server, verify vault decryption worked

### "401 Unauthorized" when calling LLM service
- **Cause:** API key mismatch or not sent
- **Solution:** 
  - Check API service has `LLM_API_KEY` in `.env`
  - Check LLM service has `LLM_API_KEYS` in `.env`
  - Verify keys match (decrypt vault to check)

## 📚 Related Documentation

- [LLM_API_KEY_GUIDE.md](./LLM_API_KEY_GUIDE.md) - Complete API key authentication guide
- [API_KEY_IMPLEMENTATION_SUMMARY.md](./API_KEY_IMPLEMENTATION_SUMMARY.md) - Implementation summary
- [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) - General secrets management guide
- [ansible/DEPLOYMENT.md](./ansible/DEPLOYMENT.md) - Full deployment guide

---

**Next Step:** Generate your API keys and encrypt them! ⬆️ Start at Step 1
