Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }
  
  const envCheck = {
    WHISH_API_URL: Deno.env.get('WHISH_API_URL') || 'DEFAULT',
    WHISH_CHANNEL: Deno.env.get('WHISH_CHANNEL') || 'MISSING',
    WHISH_SECRET: Deno.env.get('WHISH_SECRET') || 'MISSING',
    WHISH_WEBSITEURL: Deno.env.get('WHISH_WEBSITEURL') || 'MISSING',
    CALLBACK_SUCCESS_URL: Deno.env.get('CALLBACK_SUCCESS_URL') || 'MISSING',
    CALLBACK_FAILURE_URL: Deno.env.get('CALLBACK_FAILURE_URL') || 'NOT_SET',
    APP_HMAC_SECRET: Deno.env.get('APP_HMAC_SECRET') || 'NOT_SET',
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') || 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'NOT_SET'
  };

  return new Response(JSON.stringify({
    message: "Environment Variable Check",
    envVars: envCheck,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
});
