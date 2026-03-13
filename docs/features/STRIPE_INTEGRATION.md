# Phase 2: Stripe Payment Integration - Implementation Guide

## Overview

Phase 2 adds Stripe payment processing to enable PRO subscriptions ($9/month). Users can upgrade through the analytics dashboard or pricing page.

## What Was Implemented

### Backend (API Service)

#### 1. Database Schema Updates
**File:** `apps/api-service/prisma/schema.prisma`
- Added `stripeCustomerId` (unique, nullable) - Links to Stripe customer
- Added `stripeSubscriptionId` (unique, nullable) - Tracks active subscription
- Added `customDomain` (unique, nullable) - Future PRO feature for custom subdomains
- Added indexes on `stripeCustomerId` and `customDomain`

**Migration Required:**
```bash
cd apps/api-service
npm run prisma:migrate dev --name add_stripe_fields
npm run prisma:generate
```

#### 2. SubscriptionsService
**File:** `apps/api-service/src/features/subscriptions/subscriptions.service.ts`

**Methods:**
- `createCheckoutSession()` - Creates Stripe checkout session, manages customer creation
- `createPortalSession()` - Generates Stripe customer portal URL for subscription management
- `handleWebhook()` - Processes Stripe webhook events
- `handleCheckoutCompleted()` - Upgrades user to PRO after successful payment
- `handleSubscriptionUpdated()` - Handles renewals and plan changes
- `handleSubscriptionDeleted()` - Downgrades user to FREE on cancellation

**Webhook Events Handled:**
- `checkout.session.completed` - Subscription created
- `customer.subscription.updated` - Subscription renewed/changed
- `customer.subscription.deleted` - Subscription canceled

#### 3. SubscriptionsController
**File:** `apps/api-service/src/features/subscriptions/subscriptions.controller.ts`

**Endpoints:**
- `POST /api/subscriptions/checkout` - Create checkout session (authenticated)
- `POST /api/subscriptions/portal` - Create customer portal session (authenticated)
- `POST /api/subscriptions/webhooks/stripe` - Receive Stripe webhooks (public, signature-verified)

#### 4. Configuration Changes
**File:** `apps/api-service/src/main.ts`
- Enabled `rawBody: true` for Stripe webhook signature verification

**File:** `apps/api-service/src/app.module.ts`
- Added `SubscriptionsModule` to imports

### Frontend (My Resume)

#### 1. UpgradePrompt Component
**File:** `apps/my-resume/src/features/subscriptions/UpgradePrompt.tsx`

**Features:**
- Displays PRO benefits and pricing
- Calls `/api/subscriptions/checkout` endpoint
- Redirects to Stripe hosted checkout page
- Shows loading and error states
- Can be embedded in modals or used standalone

#### 2. Analytics Dashboard Integration
**File:** `apps/my-resume/src/features/analytics/AnalyticsDashboard.tsx`

**Changes:**
- Added `showUpgradePrompt` state
- "Upgrade to PRO" buttons now open UpgradePrompt modal
- Modal uses DaisyUI dialog component
- Seamless upgrade flow from analytics view

## Environment Variables

### API Service (.env)
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Webhook settings
STRIPE_PRICE_ID=price_...  # PRO subscription price ID
FRONTEND_URL=http://localhost:3001  # For redirect URLs
```

### Frontend (.env)
```bash
# Stripe Configuration
PUBLIC_STRIPE_PRICE_ID=price_...  # Same as backend price ID
```

## Stripe Dashboard Setup

### 1. Create Product
1. Go to Stripe Dashboard → Products
2. Create new product: "ResumeCast.ai PRO"
3. Add price: $9.00 USD / month, recurring
4. Copy the price ID (starts with `price_`)

### 2. Configure Webhooks
1. Go to Developers → Webhooks
2. Add endpoint: `https://resumecast.ai/api/subscriptions/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret (starts with `whsec_`)

### 3. Get API Keys
1. Go to Developers → API Keys
2. Copy "Secret key" (starts with `sk_test_` for test mode)
3. Use "Publishable key" if implementing Stripe Elements (future enhancement)

## Testing

### Local Testing

#### 1. Install Dependencies
```bash
cd apps/api-service
npm install stripe

cd ../my-resume
# No additional dependencies needed
```

#### 2. Setup Environment
```bash
# API Service
cd apps/api-service
cp .env.stripe.example .env.local
# Edit .env.local with your Stripe keys

# Frontend
cd apps/my-resume
cp .env.stripe.example .env.local
# Edit .env.local with price ID
```

#### 3. Run Stripe CLI (for webhook testing)
```bash
stripe listen --forward-to localhost:3000/api/subscriptions/webhooks/stripe
# Copy webhook secret from output, update .env.local
```

#### 4. Start Services
```bash
# Terminal 1: API Service
cd apps/api-service
npm run prisma:generate
npm run start:dev

# Terminal 2: Frontend
cd apps/my-resume
yarn dev

# Terminal 3: Stripe CLI
stripe listen --forward-to localhost:3000/api/subscriptions/webhooks/stripe
```

#### 5. Test Checkout Flow
1. Open http://localhost:3001/dashboard
2. Click analytics icon for a resume
3. Click "Upgrade to PRO"
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC
5. Complete checkout
6. Should redirect back to dashboard
7. Check console logs for webhook processing

### Production Testing

#### 1. Deploy Code
```bash
cd ansible
./deploy_with_conda.sh
```

#### 2. Configure Environment on Server
```bash
ssh user@172.16.23.127
cd /opt/my-resume/apps/api-service
nano .env
# Add:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_PRICE_ID=price_...
# FRONTEND_URL=https://resumecast.ai
```

#### 3. Restart Services
```bash
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate /opt/my-resume/apps/api-service/conda-env
pm2 restart api-service
```

#### 4. Test with Real Card or Test Mode
Use Stripe test mode first, then switch to live mode when ready.

## Subscription Management

### Customer Portal
Users can manage their subscription at: `https://resumecast.ai/dashboard` → "Manage Subscription"
- Update payment method
- Cancel subscription
- View invoices
- Change billing info

### Manual Subscription Management
```bash
# Check user subscription status
PGPASSWORD=your-password psql -h localhost -U resume_user -d resume_db \
  -c "SELECT email, subscriptionTier, stripeCustomerId, stripeSubscriptionId, subscriptionEndsAt FROM \"User\" WHERE email = 'user@example.com';"

# Manually upgrade user (for testing)
PGPASSWORD=your-password psql -h localhost -U resume_user -d resume_db \
  -c "UPDATE \"User\" SET subscriptionTier = 'PRO', subscriptionEndsAt = NOW() + INTERVAL '1 month' WHERE email = 'user@example.com';"
```

## Troubleshooting

### Issue: "STRIPE_SECRET_KEY is not configured"
**Solution:** Add `STRIPE_SECRET_KEY` to `.env` file in `apps/api-service/`

### Issue: Webhook signature verification failed
**Solution:** 
1. Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Ensure `rawBody: true` is enabled in `main.ts`
3. Verify webhook endpoint URL matches production URL

### Issue: User not upgraded after checkout
**Solution:**
1. Check PM2 logs: `pm2 logs api-service | grep webhook`
2. Verify webhook event reached server (Stripe Dashboard → Webhooks → Events)
3. Check database: `SELECT * FROM "User" WHERE email = 'user@example.com';`

### Issue: Checkout redirect fails
**Solution:**
1. Verify `FRONTEND_URL` in API `.env` matches actual frontend URL
2. Check success/cancel URLs in checkout session
3. Ensure CORS allows frontend origin

## Security Considerations

1. **Never expose `STRIPE_SECRET_KEY`** - Server-side only
2. **Always verify webhook signatures** - Prevents fake webhook attacks
3. **Use HTTPS in production** - Required for Stripe
4. **Validate price ID on backend** - Don't trust client input
5. **Rate limit checkout endpoint** - Prevent abuse

## Next Steps (Phase 3)

- [ ] Custom subdomain implementation (requires DNS/nginx config)
- [ ] Stripe Elements for embedded checkout (vs hosted page)
- [ ] Annual billing option with discount
- [ ] ENTERPRISE tier with custom pricing
- [ ] Usage-based billing for additional features
- [ ] Referral program with Stripe coupons
- [ ] Dunning management for failed payments

## Files Created/Modified

### Backend
- ✅ `apps/api-service/prisma/schema.prisma` - Added Stripe fields
- ✅ `apps/api-service/src/features/subscriptions/subscriptions.module.ts`
- ✅ `apps/api-service/src/features/subscriptions/subscriptions.service.ts`
- ✅ `apps/api-service/src/features/subscriptions/subscriptions.controller.ts`
- ✅ `apps/api-service/src/features/subscriptions/dto/create-checkout.dto.ts`
- ✅ `apps/api-service/src/app.module.ts` - Added SubscriptionsModule
- ✅ `apps/api-service/src/main.ts` - Enabled rawBody
- ✅ `apps/api-service/.env.stripe.example` - Environment template

### Frontend
- ✅ `apps/my-resume/src/features/subscriptions/UpgradePrompt.tsx`
- ✅ `apps/my-resume/src/features/subscriptions/UpgradePrompt.css`
- ✅ `apps/my-resume/src/features/subscriptions/index.ts`
- ✅ `apps/my-resume/src/features/analytics/AnalyticsDashboard.tsx` - Integrated UpgradePrompt
- ✅ `apps/my-resume/.env.stripe.example` - Environment template

## Deployment Checklist

- [ ] Run Prisma migration on production database
- [ ] Add Stripe environment variables to server
- [ ] Configure Stripe webhook endpoint
- [ ] Test checkout flow in Stripe test mode
- [ ] Verify webhook events are received
- [ ] Test subscription upgrade/downgrade
- [ ] Switch to live mode when ready
- [ ] Monitor PM2 logs for errors
- [ ] Test customer portal access
- [ ] Update Ansible playbook with new env vars (optional)
