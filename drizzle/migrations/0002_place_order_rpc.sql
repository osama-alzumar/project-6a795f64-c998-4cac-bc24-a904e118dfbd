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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _no bigint;
BEGIN
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'order items required';
  END IF;

  INSERT INTO public.orders (items, total, branch_id, branch_name, customer_name, customer_phone)
  VALUES (_items, COALESCE(_total, 0), _branch_id, left(_branch_name, 120), left(_customer_name, 120), left(_customer_phone, 40))
  RETURNING order_no INTO _no;

  RETURN _no;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, numeric, uuid, text, text, text) TO anon, authenticated;