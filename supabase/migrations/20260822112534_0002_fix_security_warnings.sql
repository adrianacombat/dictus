/*
# Fix security advisor warnings

1. Revoke EXECUTE on handle_new_user from anon and authenticated roles
   (it should only run as a trigger, not be callable via REST API)
2. Add fixed search_path to update_contas_atualizado_em
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_contas_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;
