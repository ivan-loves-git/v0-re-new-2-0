-- W-105 production hardening: Supabase default grants include TRUNCATE,
-- REFERENCES and TRIGGER for service_role. External Pursuit writes must remain
-- available only through the narrow SECURITY DEFINER RPC boundary.

REVOKE ALL ON TABLE
  public.external_pursuits,
  public.external_pursuit_notes,
  public.external_pursuit_staff_notes,
  public.external_pursuit_contacts,
  public.external_pursuit_audit_events,
  public.external_pursuit_deletion_tombstones
FROM service_role;

GRANT SELECT ON TABLE
  public.external_pursuits,
  public.external_pursuit_notes,
  public.external_pursuit_staff_notes,
  public.external_pursuit_contacts,
  public.external_pursuit_audit_events,
  public.external_pursuit_deletion_tombstones
TO service_role;
