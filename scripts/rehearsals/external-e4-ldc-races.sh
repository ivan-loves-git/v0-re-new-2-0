# Sourced only inside the generated socket-only PG17 harness; reuse its exact
# clients and EXIT trap. Independent sessions, no Supabase/provider endpoint.
"${psql[@]}" -q -c "BEGIN; SELECT public.synthetic_ldc_race_record('record-first'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/ldc-record-first.log" 2>&1 &
ldc_pid=$!
sleep 0.2
"${psql[@]}" -q -c "DO \$\$ BEGIN IF EXISTS(SELECT 1 FROM public.journey_claim_ldc_cleanup((SELECT stage_id FROM public.synthetic_ldc_races WHERE kind='record-first'),(SELECT operation_key FROM public.synthetic_ldc_races WHERE kind='record-first'),'w173-staff')) THEN RAISE EXCEPTION 'cleanup_crossed_record_lock'; END IF; END \$\$;" >/dev/null
if "${psql[@]}" -q -c "BEGIN; SET LOCAL lock_timeout='100ms'; UPDATE public.repreneurs SET ldc_url='cvs/replacement-race.pdf' WHERE id='76000000-0000-4000-8000-000000000004'; ROLLBACK;" > "$cluster_dir/ldc-replacement-second.log" 2>&1; then echo "Replacement crossed E4 source lock" >&2; exit 1; fi
grep 'lock timeout' "$cluster_dir/ldc-replacement-second.log" >/dev/null
if "${psql[@]}" -q -c "BEGIN; SET LOCAL lock_timeout='100ms'; DELETE FROM storage.objects WHERE id=(SELECT (context->'ldc'->>'source_object_id')::uuid FROM public.synthetic_ldc_races WHERE kind='record-first'); ROLLBACK;" > "$cluster_dir/ldc-source-delete-second.log" 2>&1; then echo "Original delete crossed E4 source version lock" >&2; exit 1; fi
grep 'lock timeout' "$cluster_dir/ldc-source-delete-second.log" >/dev/null
wait "$ldc_pid"
"${psql[@]}" -q -c "BEGIN; SELECT * FROM public.journey_claim_ldc_cleanup((SELECT stage_id FROM public.synthetic_ldc_races WHERE kind='cleanup-first'),(SELECT operation_key FROM public.synthetic_ldc_races WHERE kind='cleanup-first'),'w173-staff'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/ldc-cleanup-first.log" 2>&1 &
ldc_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "SELECT public.synthetic_ldc_race_record('cleanup-first');" > "$cluster_dir/ldc-record-after-cleanup.log" 2>&1; then echo "E4 finalized a cleanup-owned stage" >&2; exit 1; fi
grep 'external_ldc_stage_invalid' "$cluster_dir/ldc-record-after-cleanup.log" >/dev/null
wait "$ldc_pid"
"${psql[@]}" -q -c "BEGIN; SELECT public.pause_opportunity_with_reason((SELECT opportunity_id FROM public.synthetic_ldc_races WHERE kind='pause-first'),'seller_paused_sale','w173-staff',NULL); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/ldc-pause-first.log" 2>&1 &
ldc_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "SELECT public.synthetic_ldc_race_record('pause-first');" > "$cluster_dir/ldc-record-after-pause.log" 2>&1; then echo "E4 crossed Pause" >&2; exit 1; fi
wait "$ldc_pid"
"${psql[@]}" -q -c "BEGIN; SELECT public.journey_transition_terminal((SELECT match_id FROM public.synthetic_ldc_races WHERE kind='drop-first'),'drop','w173-staff@example.test','ldc-drop-race','buyer_search_paused'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/ldc-drop-first.log" 2>&1 &
ldc_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "SELECT public.synthetic_ldc_race_record('drop-first');" > "$cluster_dir/ldc-record-after-drop.log" 2>&1; then echo "E4 crossed Drop" >&2; exit 1; fi
wait "$ldc_pid"
"${psql[@]}" -q -c "BEGIN; UPDATE public.repreneurs SET ldc_url='cvs/76000000-0000-4000-8000-000000000004/ldc/replacement-missing.pdf' WHERE id='76000000-0000-4000-8000-000000000004'; SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/ldc-source-first.log" 2>&1 &
ldc_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "SELECT public.synthetic_ldc_race_record('source-first');" > "$cluster_dir/ldc-record-after-source.log" 2>&1; then echo "E4 crossed source replacement" >&2; exit 1; fi
wait "$ldc_pid"
"${psql[@]}" -q -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs WHERE operation_key IN (SELECT operation_key FROM public.synthetic_ldc_races))<>1 OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs WHERE operation_key=(SELECT operation_key FROM public.synthetic_ldc_races WHERE kind='record-first')) OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE match_id IN (SELECT match_id FROM public.synthetic_ldc_races)) OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries WHERE match_id IN (SELECT match_id FROM public.synthetic_ldc_races)) THEN RAISE EXCEPTION 'ldc_races_created_partial_or_provider_effects'; END IF; END \$\$;" >/dev/null
if [[ "${RENEW_EXTERNAL_LDC_BYTES_REHEARSAL:-0}" == "1" ]]; then
  RENEW_LDC_NATIVE_SOCKET="$cluster_dir" RENEW_LDC_NATIVE_PORT="$port" RENEW_LDC_NATIVE_FINISH=1 node "$repo_root/scripts/rehearsals/external-e4-ldc-bytes.cjs"
fi
echo "Independent-session E4 record/cleanup/source replacement/deletion/Pause/Drop fences passed."
