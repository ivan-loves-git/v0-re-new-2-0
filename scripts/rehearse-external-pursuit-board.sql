\set ON_ERROR_STOP on

-- W-106 disposable PG17 rehearsal. All fixtures are rolled back.
BEGIN;

INSERT INTO public.repreneurs (id, email, first_name, last_name)
VALUES
  ('10600000-0000-4000-8000-000000000001', 'w106-owner@example.invalid', 'W106', 'Owner'),
  ('10600000-0000-4000-8000-000000000002', 'w106-other@example.invalid', 'W106', 'Other');

INSERT INTO public.app_user_roles (user_id, email, role, repreneur_id)
VALUES
  ('w106-owner-user', 'w106-owner@example.invalid', 'repreneur', '10600000-0000-4000-8000-000000000001'),
  ('w106-other-user', 'w106-other@example.invalid', 'repreneur', '10600000-0000-4000-8000-000000000002'),
  ('w106-staff-user', 'w106-staff@example.invalid', 'staff', NULL);

SET LOCAL ROLE service_role;
SELECT public.create_external_pursuit_v2(
  '10600000-0000-4000-8000-000000000001', 'Initial title', 'identified', 'unknown',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'w106-owner-user', 'w106-create-runtime'
) AS dossier_id \gset

SELECT public.update_external_pursuit_v2(
  :'dossier_id', 'Owner latest title', NULL, FALSE, NULL, FALSE, NULL, FALSE,
  NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE,
  NULL, FALSE, NULL, FALSE, NULL, FALSE,
  'w106-owner-user', 'w106-owner-title-update'
);

-- Staff acts from a stale card, but the narrow mutation carries no title.
SELECT public.move_external_pursuit_stage(
  :'dossier_id', 'meetings', 'w106-staff-user', 'w106-staff-stage-move'
);

-- Two contacts are saved. Replaying the first key after the second save must
-- return the original contact rather than duplicating it.
SELECT public.save_external_pursuit_contact(
  :'dossier_id', NULL, 'Alex Buyer', NULL, NULL, 'alex@example.invalid', NULL,
  'w106-owner-user', 'w106-owner-save:contact:client-a'
) AS first_contact_id \gset
SELECT public.save_external_pursuit_contact(
  :'dossier_id', NULL, NULL, 'Buyer Co', 'CEO', NULL, '+33 1 23 45 67 89',
  'w106-owner-user', 'w106-owner-save:contact:client-b'
) AS second_contact_id \gset
SELECT public.save_external_pursuit_contact(
  :'dossier_id', NULL, 'Alex Buyer', NULL, NULL, 'alex@example.invalid', NULL,
  'w106-owner-user', 'w106-owner-save:contact:client-a'
) AS first_contact_replay_id \gset
RESET ROLE;

-- Another owner is denied even though the caller uses the service-role
-- transport. The actor supplied to the SECURITY DEFINER function owns access.
DO $$
DECLARE target_id UUID; was_denied BOOLEAN := FALSE;
BEGIN
  SELECT id INTO target_id FROM public.external_pursuits
    WHERE create_idempotency_key = 'w106-create-runtime';
  BEGIN
    PERFORM public.external_pursuit_for_actor(target_id, 'w106-other-user');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%access denied%' THEN was_denied := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT was_denied THEN RAISE EXCEPTION 'W-106 other-owner denial assertion failed.'; END IF;
END $$;

SELECT (
  dossier.id IS NOT NULL
  AND dossier.title = 'Owner latest title'
  AND dossier.stage = 'meetings'
  AND dossier.availability = 'unknown'
  AND dossier.external_url IS NULL
  AND dossier.target_company IS NULL
  AND dossier.source_channel IS NULL
  AND dossier.revenue_meur IS NULL
  AND dossier.ebitda_keur IS NULL
  AND dossier.headcount IS NULL
  AND :'first_contact_id'::UUID = :'first_contact_replay_id'::UUID
  AND :'first_contact_id'::UUID <> :'second_contact_id'::UUID
  AND (SELECT COUNT(*) FROM public.external_pursuit_contacts contact WHERE contact.external_pursuit_id = dossier.id) = 2
  AND (SELECT COUNT(*) FROM public.external_pursuit_audit_events audit WHERE audit.external_pursuit_id = dossier.id AND audit.event_type = 'contact_created') = 2
  AND EXISTS (
    SELECT 1 FROM public.external_pursuit_audit_events audit
    WHERE audit.external_pursuit_id = dossier.id AND audit.actor_user_id = 'w106-staff-user'
      AND audit.idempotency_key = 'w106-staff-stage-move'
      AND audit.metadata = '{"field":"stage","stage":"meetings"}'::jsonb
  )
) AS w106_runtime_ok
FROM public.external_pursuits dossier
WHERE dossier.id = :'dossier_id'
\gset

\if :w106_runtime_ok
  \echo 'W-106 runtime create, role denial, multi-contact replay and stale-title stage-move rehearsal passed.'
\else
  \echo 'W-106 runtime rehearsal failed.'
  \quit 1
\endif

-- Simulate an ambiguous client failure after the second contact has committed.
-- Reusing the old parent/contact keys with attempted edits proves PostgreSQL
-- will replay the original payload. The UI must therefore freeze that exact
-- snapshot through recovery, then use fresh keys for later edits.
SET LOCAL ROLE service_role;
SELECT public.create_external_pursuit_v2(
  '10600000-0000-4000-8000-000000000001', 'Snapshot title', 'identified', 'unknown',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'w106-owner-user', 'w106-snapshot-parent'
) AS snapshot_dossier_id \gset
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, 'Alex Original', NULL, NULL, 'alex-original@example.invalid', NULL,
  'w106-owner-user', 'w106-snapshot-parent:contact:client-a'
) AS snapshot_first_contact_id \gset
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, NULL, 'Buyer Original', NULL, NULL, '+33 1 00 00 00 00',
  'w106-owner-user', 'w106-snapshot-parent:contact:client-b'
) AS snapshot_second_contact_id \gset

-- These are the edits the client must not send while recovering old keys.
SELECT public.create_external_pursuit_v2(
  '10600000-0000-4000-8000-000000000001', 'Attempted title edit', 'identified', 'unknown',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'w106-owner-user', 'w106-snapshot-parent'
) AS snapshot_parent_changed_replay_id \gset
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, 'Alex Attempted Edit', NULL, NULL, 'alex-edited@example.invalid', NULL,
  'w106-owner-user', 'w106-snapshot-parent:contact:client-a'
) AS snapshot_first_changed_replay_id \gset
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, NULL, 'Buyer Attempted Edit', NULL, NULL, '+33 1 99 99 99 99',
  'w106-owner-user', 'w106-snapshot-parent:contact:client-b'
) AS snapshot_second_changed_replay_id \gset

-- Exact recovery repeats the frozen original values and returns the same rows.
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, 'Alex Original', NULL, NULL, 'alex-original@example.invalid', NULL,
  'w106-owner-user', 'w106-snapshot-parent:contact:client-a'
) AS snapshot_first_exact_replay_id \gset
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', NULL, NULL, 'Buyer Original', NULL, NULL, '+33 1 00 00 00 00',
  'w106-owner-user', 'w106-snapshot-parent:contact:client-b'
) AS snapshot_second_exact_replay_id \gset

-- Once recovery is complete, a new edit uses new keys and is persisted.
SELECT public.update_external_pursuit_v2(
  :'snapshot_dossier_id', 'Fresh title edit', NULL, FALSE, NULL, FALSE, NULL, FALSE,
  NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE,
  NULL, FALSE, NULL, FALSE, NULL, FALSE,
  'w106-owner-user', 'w106-snapshot-fresh-parent-edit'
);
SELECT public.save_external_pursuit_contact(
  :'snapshot_dossier_id', :'snapshot_second_contact_id', NULL, 'Buyer Fresh Edit', NULL, NULL, '+33 1 11 11 11 11',
  'w106-owner-user', 'w106-snapshot-fresh-contact-edit'
) AS snapshot_second_fresh_id \gset
RESET ROLE;

SELECT (
  :'snapshot_dossier_id'::UUID = :'snapshot_parent_changed_replay_id'::UUID
  AND :'snapshot_first_contact_id'::UUID = :'snapshot_first_changed_replay_id'::UUID
  AND :'snapshot_first_contact_id'::UUID = :'snapshot_first_exact_replay_id'::UUID
  AND :'snapshot_second_contact_id'::UUID = :'snapshot_second_changed_replay_id'::UUID
  AND :'snapshot_second_contact_id'::UUID = :'snapshot_second_exact_replay_id'::UUID
  AND :'snapshot_second_contact_id'::UUID = :'snapshot_second_fresh_id'::UUID
  AND dossier.title = 'Fresh title edit'
  AND (SELECT COUNT(*) FROM public.external_pursuit_contacts contact WHERE contact.external_pursuit_id = dossier.id) = 2
  AND EXISTS (
    SELECT 1 FROM public.external_pursuit_contacts contact
    WHERE contact.id = :'snapshot_first_contact_id' AND contact.name = 'Alex Original'
      AND contact.email = 'alex-original@example.invalid'
  )
  AND EXISTS (
    SELECT 1 FROM public.external_pursuit_contacts contact
    WHERE contact.id = :'snapshot_second_contact_id' AND contact.organisation = 'Buyer Fresh Edit'
      AND contact.phone = '+33 1 11 11 11 11'
  )
) AS snapshot_recovery_ok
FROM public.external_pursuits dossier
WHERE dossier.id = :'snapshot_dossier_id'
\gset

\if :snapshot_recovery_ok
  \echo 'W-106 second-contact ambiguity, exact snapshot recovery and fresh-edit rehearsal passed.'
\else
  \echo 'W-106 submission snapshot recovery rehearsal failed.'
  \quit 1
\endif

-- Deletion request and staff fulfillment also recover exactly with the same
-- per-operation key. The pending card stays fully visible to staff, including
-- contacts, and disappears from the owner projection before fulfillment.
SET LOCAL ROLE service_role;
SELECT public.create_external_pursuit_v2(
  '10600000-0000-4000-8000-000000000001', 'Deletion retry dossier', 'identified', 'unknown',
  NULL, NULL, NULL, 'https://example.invalid/dossier', 'Delete Target', 'Direct', 1, 2, 3,
  'w106-owner-user', 'w106-delete-create'
) AS deletion_dossier_id \gset
SELECT public.save_external_pursuit_contact(
  :'deletion_dossier_id', NULL, 'Delete Contact', NULL, NULL, 'delete@example.invalid', NULL,
  'w106-owner-user', 'w106-delete-save:contact:stable'
);
SELECT public.request_external_pursuit_deletion(
  :'deletion_dossier_id', 'w106-owner-user', 'w106-delete-request'
);
SELECT public.request_external_pursuit_deletion(
  :'deletion_dossier_id', 'w106-owner-user', 'w106-delete-request'
);
SELECT (
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.external_pursuit_board_for_actor('w106-owner-user')) row
    WHERE row->>'id' = :'deletion_dossier_id'
  )
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.external_pursuit_board_for_actor('w106-staff-user')) row
    WHERE row->>'id' = :'deletion_dossier_id'
      AND row->>'deletion_status' = 'delete_requested'
      AND row->>'target_company' = 'Delete Target'
      AND jsonb_array_length(row->'contacts') = 1
  )
) AS pending_visibility_ok \gset
SELECT public.fulfill_external_pursuit_deletion(
  :'deletion_dossier_id', 'w106-staff-user', 'w106-delete-fulfill'
);
SELECT public.fulfill_external_pursuit_deletion(
  :'deletion_dossier_id', 'w106-staff-user', 'w106-delete-fulfill'
);
RESET ROLE;

SELECT (
  :'pending_visibility_ok'::BOOLEAN
  AND NOT EXISTS (SELECT 1 FROM public.external_pursuits WHERE id = :'deletion_dossier_id')
  AND (SELECT COUNT(*) FROM public.external_pursuit_deletion_tombstones WHERE former_dossier_id = :'deletion_dossier_id' AND fulfillment_idempotency_key = 'w106-delete-fulfill') = 1
) AS deletion_retry_ok \gset

\if :deletion_retry_ok
  \echo 'W-106 pending visibility and deletion retry rehearsal passed.'
\else
  \echo 'W-106 deletion retry rehearsal failed.'
  \quit 1
\endif

ROLLBACK;
