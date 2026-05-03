-- Drop the old function by its exact signature
DROP FUNCTION IF EXISTS complete_order(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT);

-- Verify only one function remains
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname = 'complete_order' 
  AND n.nspname = 'public';
  
  IF func_count > 1 THEN
    RAISE WARNING 'Still % functions named complete_order', func_count;
  END IF;
END;
$$;;
