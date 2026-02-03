-- Migration: Protect phone_number from direct frontend updates
-- 
-- This trigger prevents direct updates to phone_number column in public.users
-- The only way to update phone_number should be through the sync_auth_phone_to_public_users trigger
-- which fires when auth.users.phone is updated (after OTP verification)
--
-- This fixes the security issue where users could bypass phone verification
-- and directly write unverified phone numbers to the database.

CREATE OR REPLACE FUNCTION prevent_direct_phone_number_update()
RETURNS TRIGGER AS $$
DECLARE
  auth_phone text;
BEGIN
  -- Check if phone_number is being changed
  IF OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
    -- Allow update ONLY if the new phone_number matches the verified phone in auth.users
    -- This ensures the update comes from the sync trigger after OTP verification
    SELECT phone INTO auth_phone
    FROM auth.users
    WHERE id = NEW.id::uuid;
    
    -- If the new phone_number doesn't match auth.users.phone, block it
    -- This means someone is trying to update it directly without OTP verification
    IF NEW.phone_number IS DISTINCT FROM auth_phone THEN
      RAISE EXCEPTION 'Direct updates to phone_number are not allowed. Phone number can only be changed through phone verification. Current auth.users.phone: %, Attempted: %', auth_phone, NEW.phone_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_direct_phone_update ON public.users;
CREATE TRIGGER prevent_direct_phone_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_phone_number_update();

-- Add a comment explaining the protection
COMMENT ON TRIGGER prevent_direct_phone_update ON public.users IS 
'Prevents authenticated users from directly updating phone_number. Phone must be changed through OTP verification which updates auth.users.phone, then syncs via trigger.';
