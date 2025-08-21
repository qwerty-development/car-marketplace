# Supabase Environment Variables Setup

This document lists all the environment variables you need to set in your Supabase project for the Whish payment integration to work.

## How to Set Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Environment Variables**
3. Add each variable below with its corresponding value

## Required Environment Variables

### Whish API Configuration

```bash
# Whish API Base URL (use sandbox for testing)
WHISH_API_URL=https://lb.sandbox.whish.money/itel-service/api/

# Your Whish credentials (provided by Whish)
WHISH_CHANNEL=10196115
WHISH_SECRET=80af9650b74c4c209e0e0daa5d7d331e
WHISH_WEBSITEURL=fleetapp.me
```

### Callback URLs

```bash
# Success callback URL (points to your whish-success edge function)
CALLBACK_SUCCESS_URL=https://your-project-ref.supabase.co/functions/v1/whish-success

# Failure callback URL (optional - if not set, uses success URL)
CALLBACK_FAILURE_URL=https://your-project-ref.supabase.co/functions/v1/whish-success
```

### Security

```bash
# Generate a secure random string for HMAC signing
# Use: openssl rand -hex 32
APP_HMAC_SECRET=your_secure_random_32_character_hex_string
```

### Pricing Configuration

```bash
# Subscription prices in USD
PRICE_MONTHLY_USD=1
PRICE_YEARLY_USD=2500
```

### Redirect URLs (shown to user after payment)

```bash
# Where users are redirected after successful payment
SUCCESS_REDIRECT_URL=https://fleetapp.me/success

# Where users are redirected after failed payment
FAILURE_REDIRECT_URL=https://fleetapp.me/failure
```

## Automatically Available Variables

These are automatically provided by Supabase for Edge Functions:

```bash
# Supabase project URL and service role key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Quick Setup Script

Replace `your-project-ref` with your actual Supabase project reference and run this in your terminal:

```bash
# Generate HMAC secret
HMAC_SECRET=$(openssl rand -hex 32)
echo "Generated HMAC Secret: $HMAC_SECRET"

# Set your Supabase project reference
PROJECT_REF="your-project-ref"

echo "Set these environment variables in your Supabase Dashboard:"
echo ""
echo "WHISH_API_URL=https://lb.sandbox.whish.money/itel-service/api/"
echo "WHISH_CHANNEL=10196115"
echo "WHISH_SECRET=80af9650b74c4c209e0e0daa5d7d331e"
echo "WHISH_WEBSITEURL=fleetapp.me"
echo "CALLBACK_SUCCESS_URL=https://${PROJECT_REF}.supabase.co/functions/v1/whish-success"
echo "CALLBACK_FAILURE_URL=https://${PROJECT_REF}.supabase.co/functions/v1/whish-success"
echo "APP_HMAC_SECRET=$HMAC_SECRET"
echo "PRICE_MONTHLY_USD=1"
echo "PRICE_YEARLY_USD=2500"
echo "SUCCESS_REDIRECT_URL=https://fleetapp.me/success"
echo "FAILURE_REDIRECT_URL=https://fleetapp.me/failure"
```

## Production Considerations

When moving to production:

1. **Change WHISH_API_URL** to production URL: `https://whish.money/itel-service/api/`
2. **Get production credentials** from Whish (channel, secret, websiteurl)
3. **Update pricing** to real values (currently set to $1 monthly for testing)
4. **Generate new HMAC secret** for production
5. **Update redirect URLs** to your actual website URLs

## Testing the Setup

Once all variables are set, you can test the integration:

1. **Deploy your Edge Functions:**
   ```bash
   supabase functions deploy whish-create-payment
   supabase functions deploy whish-success
   ```

2. **Test payment creation:**
   ```bash
   curl -X POST "https://your-project-ref.supabase.co/functions/v1/whish-create-payment" \
     -H "Content-Type: application/json" \
     -H "apikey: your_supabase_anon_key" \
     -H "Authorization: Bearer your_supabase_anon_key" \
     -d '{"dealerId": 123, "plan": "monthly"}'
   ```

3. **Test callback handler:**
   ```bash
   curl "https://your-project-ref.supabase.co/functions/v1/whish-success?eid=1234567890&dealerId=123&plan=monthly"
   ```

## Troubleshooting

- **500 errors:** Usually missing environment variables
- **401 errors:** Check your Supabase API keys
- **Whish errors:** Verify Whish credentials and API URL
- **No logs:** Check Supabase Edge Function logs in the dashboard
