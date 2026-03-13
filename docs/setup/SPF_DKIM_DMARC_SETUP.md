# SPF, DKIM, and DMARC Setup for resumecast.ai with AWS SES

## Overview
To prevent emails from going to spam, you need to add authentication records to your DNS:
1. **SPF** - Proves AWS is authorized to send emails from your domain
2. **DKIM** - Cryptographically signs emails to prove authenticity
3. **DMARC** - Policy for how email servers should handle emails

## Prerequisites
- You're using **Cloudflare** as your DNS provider
- You have AWS credentials configured locally
- Your domain is `resumecast.ai`

---

## Step 1: Add SPF Record (5 minutes)

### In Cloudflare Console:

1. Go to https://dash.cloudflare.com/
2. Select **resumecast.ai**
3. Click **DNS** (left sidebar)
4. Click **Add record** button
5. Fill in:
   - **Type:** `TXT`
   - **Name:** `@` (root domain)
   - **Content:** `v=spf1 include:amazonses.com ~all`
   - **TTL:** `Auto`
   - **Proxy status:** `DNS only` ⚠️ **Important: Do NOT proxy DNS records for email**
6. Click **Save**

**Result:** SPF record created
```
@  TXT  v=spf1 include:amazonses.com ~all
```

---

## Step 2: Get DKIM Tokens from AWS (2 minutes)

Run this command to get your DKIM tokens:

```bash
aws ses verify-domain-dkim --domain resumecast.ai --region us-east-1 --output table
```

**Output will be 3 tokens, like:**
```
| DkimTokens            |
|=====================|
| abc123def456ghi789   |
| jkl456mno789pqr012   |
| stu456vwx789yz01234 |
```

**Copy these tokens** - you'll need them for the next step.

---

## Step 3: Add DKIM CNAME Records to Cloudflare (10 minutes)

For each of the 3 DKIM tokens above, create a CNAME record:

### Record 1:
1. In Cloudflare, click **Add record**
2. Fill in:
   - **Type:** `CNAME`
   - **Name:** `abc123def456ghi789._domainkey`
   - **Content:** `abc123def456ghi789.dkim.amazonses.com`
   - **TTL:** `Auto`
   - **Proxy status:** `DNS only` ⚠️ **Must be DNS only**
3. Click **Save**

### Record 2:
1. Click **Add record**
2. Fill in:
   - **Type:** `CNAME`
   - **Name:** `jkl456mno789pqr012._domainkey`
   - **Content:** `jkl456mno789pqr012.dkim.amazonses.com`
   - **TTL:** `Auto`
   - **Proxy status:** `DNS only`
3. Click **Save**

### Record 3:
1. Click **Add record**
2. Fill in:
   - **Type:** `CNAME`
   - **Name:** `stu456vwx789yz01234._domainkey`
   - **Content:** `stu456vwx789yz01234.dkim.amazonses.com`
   - **TTL:** `Auto`
   - **Proxy status:** `DNS only`
3. Click **Save**

**Result:** 3 CNAME records created
```
abc123...._domainkey  CNAME  abc123....dkim.amazonses.com
jkl456...._domainkey  CNAME  jkl456....dkim.amazonses.com
stu456...._domainkey  CNAME  stu456....dkim.amazonses.com
```

---

## Step 4: Add DMARC Record (Optional but Recommended) (5 minutes)

1. In Cloudflare, click **Add record**
2. Fill in:
   - **Type:** `TXT`
   - **Name:** `_dmarc`
   - **Content:** `v=DMARC1; p=quarantine; rua=mailto:admin@resumecast.ai`
   - **TTL:** `Auto`
   - **Proxy status:** `DNS only`
3. Click **Save**

**Result:** DMARC record created
```
_dmarc  TXT  v=DMARC1; p=quarantine; rua=mailto:admin@resumecast.ai
```

---

## Step 5: Verify DNS Records (5 minutes)

After adding all records, verify they're propagated:

```bash
# Check SPF
dig resumecast.ai TXT | grep "v=spf1"

# Check DKIM
dig abc123def456ghi789._domainkey.resumecast.ai CNAME

# Check DMARC
dig _dmarc.resumecast.ai TXT
```

Expected output should show your records.

---

## Step 6: Check AWS SES Domain Status

```bash
aws ses get-identity-verification-attributes \
  --identities resumecast.ai \
  --region us-east-1 \
  --output table
```

Once all DNS records propagate (5-30 minutes), you should see:
```
|  VerificationStatus    | Success        |
|  VerificationToken     | (token here)   |
|  DkimEnabled           | True           |
|  DkimVerificationStatus| Success        |
|  DkimTokens            | [3 tokens]     |
```

---

## DNS Records Summary

Here's what your final DNS should look like in Cloudflare:

| Name | Type | Content | Proxy |
|------|------|---------|-------|
| @ | TXT | v=spf1 include:amazonses.com ~all | DNS only |
| abc123...._domainkey | CNAME | abc123....dkim.amazonses.com | DNS only |
| jkl456...._domainkey | CNAME | jkl456....dkim.amazonses.com | DNS only |
| stu456...._domainkey | CNAME | stu456....dkim.amazonses.com | DNS only |
| _dmarc | TXT | v=DMARC1; p=quarantine; rua=mailto:admin@resumecast.ai | DNS only |

---

## Troubleshooting

### Emails still going to spam?
- Wait 24-48 hours for DNS to fully propagate
- Verify all 3 DKIM tokens are added (not just 1 or 2)
- Make sure records are "DNS only", not proxied
- Check that DKIM verification shows "Success" in AWS SES

### DKIM verification still pending?
- It can take 15-30 minutes for DNS to propagate
- Use `dig` command above to verify records exist
- Run the AWS verification command again

### Can't find DKIM tokens?
- Make sure your domain is verified in AWS SES (status: Verified)
- Make sure you're in `us-east-1` region (SES is region-specific)

---

## Testing Email Sending

Once all records are added and verified, test by signing up:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

Check email deliverability at:
- https://www.mail-tester.com/ - Copy-paste email source for spam score
- Gmail - Check if email arrives in Inbox (not spam)
- Outlook - Same test

---

## References
- [AWS SES DKIM Documentation](https://docs.aws.amazon.com/ses/latest/dg/dkim.html)
- [AWS SES SPF Documentation](https://docs.aws.amazon.com/ses/latest/dg/spf.html)
- [DMARC Guide](https://dmarc.org/)
- [Cloudflare DNS Setup](https://support.cloudflare.com/hc/en-us/articles/360019093151-Managing-DNS-records-in-Cloudflare)
