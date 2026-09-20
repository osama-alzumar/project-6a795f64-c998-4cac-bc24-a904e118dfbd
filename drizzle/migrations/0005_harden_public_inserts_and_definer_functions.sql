-- 1) Remove the last publicly callable SECURITY DEFINER helper (an admin already exists)
DROP FUNCTION IF EXISTS public.claim_first_admin();

-- 2) Recreate place_order as SECURITY INVOKER with strict server-side validation
DROP FUNCTION IF EXISTS public.place_order(jsonb, numeric, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb,
  _total numeric,
  _branch_id uuid DEFAULT NULL,
  _branch_name text DEFAULT NULL,
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _item jsonb;
  _sum numeric := 0;
  _qty numeric;
  _price numeric;
BEGIN
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'order items required';
  END IF;
  IF jsonb_array_length(_items) > 60 THEN
    RAISE EXCEPTION 'too many order items';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF jsonb_typeof(_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid order item';
    END IF;
    IF jsonb_typeof(_item->'price') <> 'number' OR jsonb_typeof(_item->'qty') <> 'number' THEN
      RAISE EXCEPTION 'invalid order item';
    END IF;
    _price := (_item->>'price')::numeric;
    _qty := (_item->>'qty')::numeric;
    IF _price < 0 OR _price > 10000 OR _qty < 1 OR _qty > 100 OR _qty <> floor(_qty) THEN
      RAISE EXCEPTION 'invalid order item';
    END IF;
    IF coalesce(char_length(_item->>'name'), 0) > 160 THEN
      RAISE EXCEPTION 'invalid order item';
    END IF;
    _sum := _sum + (_price * _qty);
  END LOOP;

  IF _total IS NULL OR abs(_total - _sum) > 0.5 THEN
    RAISE EXCEPTION 'order total mismatch';
  END IF;

  INSERT INTO public.orders (items, total, branch_id, branch_name, customer_name, customer_phone)
  VALUES (
    _items,
    _sum,
    _branch_id,
    left(_branch_name, 120),
    left(_customer_name, 120),
    left(_customer_phone, 40)
  );

  RETURN currval(pg_get_serial_sequence('public.orders', 'order_no'));
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, numeric, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, numeric, uuid, text, text, text) TO anon, authenticated;

-- Invoker-rights function needs table-level INSERT privilege for the calling roles
GRANT INSERT ON public.orders TO anon, authenticated;

-- 3) Constrain order inserts (no more WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
CREATE POLICY "Anyone can create a valid order"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND jsonb_typeof(items) = 'array'
  AND jsonb_array_length(items) BETWEEN 1 AND 60
  AND total >= 0 AND total <= 100000
  AND (branch_name IS NULL OR char_length(branch_name) <= 120)
  AND (customer_name IS NULL OR char_length(customer_name) <= 120)
  AND (customer_phone IS NULL OR char_length(customer_phone) <= 40)
  AND (note IS NULL OR char_length(note) <= 500)
  AND created_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes'
);

-- 4) Constrain analytics inserts
DROP POLICY IF EXISTS "anyone can insert visits" ON public.site_visits;
CREATE POLICY "anyone can insert a valid visit"
ON public.site_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (session_id IS NULL OR char_length(session_id) <= 64)
  AND (path IS NULL OR char_length(path) <= 200)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
  AND (user_agent IS NULL OR char_length(user_agent) <= 400)
  AND (language IS NULL OR char_length(language) <= 20)
  AND (screen_size IS NULL OR char_length(screen_size) <= 24)
  AND visited_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes'
);
