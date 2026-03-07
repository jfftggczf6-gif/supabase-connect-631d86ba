
CREATE OR REPLACE FUNCTION public.link_enterprise_to_coach_by_email(enterprise_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coach_id uuid := auth.uid();
  _normalized_email text;
  _ent_id uuid;
  _existing_coach uuid;
BEGIN
  -- 1. Verify caller is a coach
  IF NOT public.has_role(_coach_id, 'coach') THEN
    RETURN 'unauthorized';
  END IF;

  -- 2. Normalize email
  _normalized_email := lower(trim(enterprise_email));
  IF _normalized_email IS NULL OR _normalized_email = '' THEN
    RETURN 'invalid_email';
  END IF;

  -- 3. Try to find enterprise by contact_email
  SELECT id, coach_id INTO _ent_id, _existing_coach
  FROM enterprises
  WHERE lower(trim(contact_email)) = _normalized_email
  LIMIT 1;

  -- 4. Fallback: find via profiles.email linked to enterprises.user_id
  IF _ent_id IS NULL THEN
    SELECT e.id, e.coach_id INTO _ent_id, _existing_coach
    FROM enterprises e
    JOIN profiles p ON p.user_id = e.user_id
    WHERE lower(trim(p.email)) = _normalized_email
    LIMIT 1;
  END IF;

  -- 5. Not found
  IF _ent_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- 6. Already assigned to this coach
  IF _existing_coach = _coach_id THEN
    RETURN 'already_yours';
  END IF;

  -- 7. Already assigned to another coach
  IF _existing_coach IS NOT NULL THEN
    RETURN 'already_assigned';
  END IF;

  -- 8. Link it
  UPDATE enterprises SET coach_id = _coach_id WHERE id = _ent_id;
  RETURN 'linked';
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_enterprise_to_coach_by_email(TEXT) TO authenticated;
