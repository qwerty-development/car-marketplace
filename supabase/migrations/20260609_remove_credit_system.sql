-- =============================================================================
-- REMOVE CREDIT SYSTEM
-- Drops credit & boost tables, functions, and cron jobs.
-- Rewrites search_cars, search_cars_rent, get_listings_by_chat_count which
-- referenced boost columns in their return types / filters.
--
-- KEEPS (intentionally NOT dropped):
--   users.credit_balance
--   cars / cars_rent: is_boosted, boost_priority, boost_end_date
--   payment_logs + cleanup_pending_payment_logs (subscription Whish payments)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CRON JOBS (safe unschedule — no-ops if job doesn't exist)
-- -----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('expire-credit-batches');    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('expire-boosted-listings');  EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. CREDIT/BOOST-ONLY FUNCTIONS
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deduct_credits_fifo(text, numeric, text, text);
DROP FUNCTION IF EXISTS public.expire_credit_batches();
DROP FUNCTION IF EXISTS public.get_credit_batches_summary(text);
DROP FUNCTION IF EXISTS public.get_user_credit_balance(text);
DROP FUNCTION IF EXISTS public.get_user_credit_balance(uuid);
DROP FUNCTION IF EXISTS public.sync_credit_balance(text);
DROP FUNCTION IF EXISTS public.get_available_boost_slots();
DROP FUNCTION IF EXISTS public.get_boost_performance(integer);
DROP FUNCTION IF EXISTS public.get_dealership_boost_summary(integer);
DROP FUNCTION IF EXISTS public.track_boost_click(integer, integer, uuid, integer);
DROP FUNCTION IF EXISTS public.track_boost_impression(integer, integer, uuid, integer);
DROP FUNCTION IF EXISTS public.is_user_dealer(uuid);

-- Catch any remaining overloads not matched above
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'sync_credit_balance',
        'deduct_credits_fifo',
        'get_credit_batches_summary',
        'expire_credit_batches',
        'get_user_credit_balance',
        'get_available_boost_slots',
        'is_user_dealer',
        'get_dealership_boost_summary',
        'get_boost_performance',
        'track_boost_impression',
        'track_boost_click'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', fn.signature);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. REWRITE search_cars — remove is_boosted/boost_priority from SELECT,
--    return type, and ORDER BY
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_cars(text, text, text, integer, integer, integer, integer, bigint, bigint, text, text, text, text, text, bigint, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_cars(
  search_text text,
  filter_make text,
  filter_model text,
  filter_year_min integer,
  filter_year_max integer,
  filter_price_min integer,
  filter_price_max integer,
  filter_mileage_min bigint,
  filter_mileage_max bigint,
  filter_condition text,
  filter_transmission text,
  filter_drivetrain text,
  filter_color text,
  filter_category text,
  filter_dealership_id bigint,
  sort_by text,
  sort_order text,
  page_limit integer,
  page_offset integer
)
RETURNS TABLE(
  id bigint, make text, model text, year integer, price integer, mileage bigint,
  condition text, transmission text, drivetrain text, color text, category text,
  type text, description text, images text[], views integer, likes integer,
  features text[], dealership_id bigint, status text, source text,
  listed_at timestamp with time zone, relevance_score real
)
LANGUAGE plpgsql
AS $$
DECLARE search_query tsquery;
BEGIN
  IF search_text IS NOT NULL AND trim(search_text) <> '' THEN
    search_query := websearch_to_tsquery('english', search_text);
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.make, c.model, c.year, c.price, c.mileage, c.condition, c.transmission,
    c.drivetrain, c.color, c.category, c.type, c.description, c.images, c.views,
    c.likes, c.features, c.dealership_id, c.status, c.source, c.listed_at,
    CASE WHEN search_query IS NOT NULL THEN ts_rank(c.search_vector, search_query) ELSE 0.0 END::REAL
  FROM cars c
  WHERE c.status = 'available'
    AND (search_query IS NULL OR c.search_vector @@ search_query)
    AND (filter_make IS NULL OR c.make ILIKE filter_make)
    AND (filter_model IS NULL OR c.model ILIKE filter_model)
    AND (filter_year_min IS NULL OR c.year >= filter_year_min)
    AND (filter_year_max IS NULL OR c.year <= filter_year_max)
    AND (filter_price_min IS NULL OR c.price >= filter_price_min)
    AND (filter_price_max IS NULL OR c.price <= filter_price_max)
    AND (filter_mileage_min IS NULL OR c.mileage >= filter_mileage_min)
    AND (filter_mileage_max IS NULL OR c.mileage <= filter_mileage_max)
    AND (filter_condition IS NULL OR c.condition ILIKE filter_condition)
    AND (filter_transmission IS NULL OR c.transmission ILIKE filter_transmission)
    AND (filter_drivetrain IS NULL OR c.drivetrain ILIKE filter_drivetrain)
    AND (filter_color IS NULL OR c.color ILIKE filter_color)
    AND (filter_category IS NULL OR c.category ILIKE filter_category)
    AND (filter_dealership_id IS NULL OR c.dealership_id = filter_dealership_id)
  ORDER BY
    CASE WHEN search_query IS NOT NULL AND sort_by = 'relevance' THEN ts_rank(c.search_vector, search_query) END DESC NULLS LAST,
    CASE WHEN sort_by = 'price' AND sort_order = 'asc' THEN c.price END ASC NULLS LAST,
    CASE WHEN sort_by = 'price' AND sort_order = 'desc' THEN c.price END DESC NULLS LAST,
    CASE WHEN sort_by = 'year' AND sort_order = 'asc' THEN c.year END ASC NULLS LAST,
    CASE WHEN sort_by = 'year' AND sort_order = 'desc' THEN c.year END DESC NULLS LAST,
    CASE WHEN sort_by = 'mileage' AND sort_order = 'asc' THEN c.mileage END ASC NULLS LAST,
    CASE WHEN sort_by = 'mileage' AND sort_order = 'desc' THEN c.mileage END DESC NULLS LAST,
    CASE WHEN sort_by = 'listed_at' OR sort_by IS NULL THEN c.listed_at END DESC NULLS LAST
  LIMIT page_limit OFFSET page_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. REWRITE search_cars_rent — same treatment
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_cars_rent(text, text, text, integer, integer, integer, integer, text, text, text, text, bigint, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_cars_rent(
  search_text text,
  filter_make text,
  filter_model text,
  filter_year_min integer,
  filter_year_max integer,
  filter_price_min integer,
  filter_price_max integer,
  filter_transmission text,
  filter_drivetrain text,
  filter_color text,
  filter_category text,
  filter_dealership_id bigint,
  filter_rental_period text,
  sort_by text,
  sort_order text,
  page_limit integer,
  page_offset integer
)
RETURNS TABLE(
  id bigint, make text, model text, year integer, price integer,
  transmission text, drivetrain text, color text, category text,
  type text, description text, images text[], views integer, likes integer,
  features text[], dealership_id bigint, status text,
  listed_at timestamp with time zone, rental_period text, relevance_score real
)
LANGUAGE plpgsql
AS $$
DECLARE search_query tsquery;
BEGIN
  IF search_text IS NOT NULL AND trim(search_text) <> '' THEN
    search_query := websearch_to_tsquery('english', search_text);
  END IF;

  RETURN QUERY
  SELECT
    cr.id, cr.make, cr.model, cr.year, cr.price, cr.transmission, cr.drivetrain,
    cr.color, cr.category, cr.type, cr.description, cr.images, cr.views, cr.likes,
    cr.features, cr.dealership_id, cr.status, cr.listed_at, cr.rental_period,
    CASE WHEN search_query IS NOT NULL THEN ts_rank(cr.search_vector, search_query) ELSE 0.0 END::REAL
  FROM cars_rent cr
  WHERE cr.status = 'available'
    AND (search_query IS NULL OR cr.search_vector @@ search_query)
    AND (filter_make IS NULL OR cr.make ILIKE filter_make)
    AND (filter_model IS NULL OR cr.model ILIKE filter_model)
    AND (filter_year_min IS NULL OR cr.year >= filter_year_min)
    AND (filter_year_max IS NULL OR cr.year <= filter_year_max)
    AND (filter_price_min IS NULL OR cr.price >= filter_price_min)
    AND (filter_price_max IS NULL OR cr.price <= filter_price_max)
    AND (filter_transmission IS NULL OR cr.transmission ILIKE filter_transmission)
    AND (filter_drivetrain IS NULL OR cr.drivetrain ILIKE filter_drivetrain)
    AND (filter_color IS NULL OR cr.color ILIKE filter_color)
    AND (filter_category IS NULL OR cr.category ILIKE filter_category)
    AND (filter_dealership_id IS NULL OR cr.dealership_id = filter_dealership_id)
    AND (filter_rental_period IS NULL OR cr.rental_period ILIKE filter_rental_period)
  ORDER BY
    CASE WHEN search_query IS NOT NULL AND sort_by = 'relevance' THEN ts_rank(cr.search_vector, search_query) END DESC NULLS LAST,
    CASE WHEN sort_by = 'price' AND sort_order = 'asc' THEN cr.price END ASC NULLS LAST,
    CASE WHEN sort_by = 'price' AND sort_order = 'desc' THEN cr.price END DESC NULLS LAST,
    CASE WHEN sort_by = 'year' AND sort_order = 'asc' THEN cr.year END ASC NULLS LAST,
    CASE WHEN sort_by = 'year' AND sort_order = 'desc' THEN cr.year END DESC NULLS LAST,
    CASE WHEN sort_by = 'listed_at' OR sort_by IS NULL THEN cr.listed_at END DESC NULLS LAST
  LIMIT page_limit OFFSET page_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. REWRITE get_listings_by_chat_count — remove p_boost_filter param and
--    all is_boosted filter logic from the body
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_listings_by_chat_count(text, text, text, integer, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_listings_by_chat_count(
  p_table_name text,
  p_owner_type text,
  p_status text,
  p_dealership_id integer,
  p_search text,
  p_page integer,
  p_per_page integer
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
  v_offset int;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid()::text;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_table_name NOT IN ('cars', 'cars_rent', 'number_plates') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_owner_type NOT IN ('dealer', 'user') THEN
    RAISE EXCEPTION 'Invalid owner type: %', p_owner_type;
  END IF;

  IF p_status NOT IN ('all', 'available', 'pending', 'sold') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  IF p_per_page > 50 THEN
    p_per_page := 50;
  END IF;

  p_search := replace(replace(replace(p_search, '%', ''), '_', ''), '\', '');

  v_offset := (p_page - 1) * p_per_page;

  IF p_table_name = 'cars' THEN
    SELECT json_build_object(
      'data', COALESCE((
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT c.*, COUNT(conv.id) as chat_count,
            (SELECT row_to_json(d) FROM dealerships d WHERE d.id = c.dealership_id) as dealerships
          FROM cars c
          LEFT JOIN conversations conv ON conv.car_id = c.id
          WHERE c.status != 'deleted'
            AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
                 OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
            AND (p_status = 'all' OR c.status = p_status)
            AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
            AND (p_search = '' OR c.make ILIKE '%' || p_search || '%'
                 OR c.model ILIKE '%' || p_search || '%'
                 OR c.description ILIKE '%' || p_search || '%'
                 OR c.color ILIKE '%' || p_search || '%')
          GROUP BY c.id
          ORDER BY COUNT(conv.id) DESC, c.listed_at DESC
          LIMIT p_per_page OFFSET v_offset
        ) t
      ), '[]'::json),
      'total_count', (
        SELECT COUNT(*)
        FROM cars c
        WHERE c.status != 'deleted'
          AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
               OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
          AND (p_status = 'all' OR c.status = p_status)
          AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
          AND (p_search = '' OR c.make ILIKE '%' || p_search || '%'
               OR c.model ILIKE '%' || p_search || '%'
               OR c.description ILIKE '%' || p_search || '%'
               OR c.color ILIKE '%' || p_search || '%')
      )
    ) INTO result;

  ELSIF p_table_name = 'cars_rent' THEN
    SELECT json_build_object(
      'data', COALESCE((
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT c.*, COUNT(conv.id) as chat_count,
            (SELECT row_to_json(d) FROM dealerships d WHERE d.id = c.dealership_id) as dealerships
          FROM cars_rent c
          LEFT JOIN conversations conv ON conv.car_rent_id = c.id
          WHERE c.status != 'deleted'
            AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
                 OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
            AND (p_status = 'all' OR c.status = p_status)
            AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
            AND (p_search = '' OR c.make ILIKE '%' || p_search || '%'
                 OR c.model ILIKE '%' || p_search || '%'
                 OR c.description ILIKE '%' || p_search || '%'
                 OR c.color ILIKE '%' || p_search || '%')
          GROUP BY c.id
          ORDER BY COUNT(conv.id) DESC, c.listed_at DESC
          LIMIT p_per_page OFFSET v_offset
        ) t
      ), '[]'::json),
      'total_count', (
        SELECT COUNT(*)
        FROM cars_rent c
        WHERE c.status != 'deleted'
          AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
               OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
          AND (p_status = 'all' OR c.status = p_status)
          AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
          AND (p_search = '' OR c.make ILIKE '%' || p_search || '%'
               OR c.model ILIKE '%' || p_search || '%'
               OR c.description ILIKE '%' || p_search || '%'
               OR c.color ILIKE '%' || p_search || '%')
      )
    ) INTO result;

  ELSE
    SELECT json_build_object(
      'data', COALESCE((
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT c.*, COUNT(conv.id) as chat_count,
            (SELECT row_to_json(d) FROM dealerships d WHERE d.id = c.dealership_id) as dealerships
          FROM number_plates c
          LEFT JOIN conversations conv ON conv.number_plate_id = c.id
          WHERE c.status != 'deleted'
            AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
                 OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
            AND (p_status = 'all' OR c.status = p_status)
            AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
            AND (p_search = '' OR c.letter ILIKE '%' || p_search || '%'
                 OR c.digits ILIKE '%' || p_search || '%')
          GROUP BY c.id
          ORDER BY COUNT(conv.id) DESC, c.created_at DESC
          LIMIT p_per_page OFFSET v_offset
        ) t
      ), '[]'::json),
      'total_count', (
        SELECT COUNT(*)
        FROM number_plates c
        WHERE c.status != 'deleted'
          AND (p_owner_type = 'dealer' AND c.dealership_id IS NOT NULL
               OR p_owner_type = 'user' AND c.user_id IS NOT NULL)
          AND (p_status = 'all' OR c.status = p_status)
          AND (p_dealership_id IS NULL OR c.dealership_id = p_dealership_id)
          AND (p_search = '' OR c.letter ILIKE '%' || p_search || '%'
               OR c.digits ILIKE '%' || p_search || '%')
      )
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. TABLES (CASCADE drops RLS policies automatically)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.boost_analytics_history CASCADE;
DROP TABLE IF EXISTS public.boost_analytics CASCADE;
DROP TABLE IF EXISTS public.boost_history CASCADE;
DROP TABLE IF EXISTS public.boosted_listings CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.credit_batches CASCADE;

-- -----------------------------------------------------------------------------
-- 7. Drop credit_balance index (column retained for possible future use)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_users_credit_balance;
