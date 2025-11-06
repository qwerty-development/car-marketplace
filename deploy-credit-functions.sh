#!/bin/bash
# Credit System Edge Functions Deployment Script

echo "🚀 Deploying Credit System Edge Functions..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${YELLOW}📋 Make sure you've linked your project first:${NC}"
echo "   supabase link --project-ref YOUR_PROJECT_REF"
echo ""
read -p "Have you linked your project? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please link your project first and run this script again${NC}"
    exit 0
fi

# Function to deploy with error handling
deploy_function() {
    local func_name=$1
    echo ""
    echo -e "${YELLOW}Deploying ${func_name}...${NC}"

    if supabase functions deploy $func_name --no-verify-jwt; then
        echo -e "${GREEN}✅ ${func_name} deployed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to deploy ${func_name}${NC}"
        return 1
    fi
}

# Deploy all functions
FAILED=0

deploy_function "credit-purchase" || FAILED=$((FAILED + 1))
deploy_function "credit-purchase-callback" || FAILED=$((FAILED + 1))
deploy_function "credit-operations" || FAILED=$((FAILED + 1))
deploy_function "expire-boosts" || FAILED=$((FAILED + 1))

echo ""
echo "================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All functions deployed successfully!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "1. Add environment variables in Supabase Dashboard → Functions → Secrets:"
    echo "   - CALLBACK_SUCCESS_URL_CREDITS=https://auth.fleetapp.me/functions/v1/credit-purchase-callback"
    echo "   - CALLBACK_FAILURE_URL_CREDITS=https://auth.fleetapp.me/functions/v1/credit-purchase-callback"
    echo ""
    echo "2. Set up cron job in Supabase Dashboard → Database → Cron Jobs"
    echo "   (See CREDIT_SYSTEM_SETUP.md for SQL)"
    echo ""
    echo "3. Test the functions with API calls"
else
    echo -e "${RED}❌ $FAILED function(s) failed to deploy${NC}"
    echo "Check the errors above and try again"
fi
echo "================================"
