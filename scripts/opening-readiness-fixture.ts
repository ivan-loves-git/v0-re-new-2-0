#!/usr/bin/env tsx

/**
 * Disposable GitHub Actions fixture for Tickets #93 and #32.
 *
 * `setup` creates only unmistakable synthetic rows in a fresh local Supabase
 * stack. `cleanup` is intentionally limited to the pre-journey smoke test. Once
 * immutable NDA/pursuit evidence exists, the caller must destroy the whole
 * local stack instead of deleting history row by row.
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Client } from "pg";
import {
  OPENING_READINESS_FIXTURE,
  assertOpeningReadinessFixtureEnvironment,
  fixtureReadbackIsHealthy,
  fixtureResidueIsZero,
  openingReadinessRunLabel,
  type OpeningFixtureCounts,
  type OpeningFixtureReadback,
} from "../lib/opening-readiness-fixture";
import { calculateOpportunityMatchScore } from "../lib/utils/opportunity-match-scoring";

const command = process.argv[2];
if (!["setup", "readback", "cleanup"].includes(command ?? "")) {
  throw new Error(
    "Usage: tsx scripts/opening-readiness-fixture.ts <setup|readback|cleanup>",
  );
}

const releaseSha = process.env.OPENING_FIXTURE_RELEASE_SHA;
if (!releaseSha)
  throw new Error("Opening fixture requires OPENING_FIXTURE_RELEASE_SHA.");
const password = process.env.OPENING_FIXTURE_PASSWORD;
if (!password || password.length < 16) {
  throw new Error(
    "Opening fixture requires an ephemeral password of at least 16 characters.",
  );
}

const runLabel = openingReadinessRunLabel(releaseSha);
const { databaseUrl } = assertOpeningReadinessFixtureEnvironment(process.env);
const client = new Client({ connectionString: databaseUrl.toString() });
const fixture = OPENING_READINESS_FIXTURE;
const syntheticUserIds = [
  fixture.authIds.staffUser,
  fixture.authIds.realUser,
  fixture.authIds.demoUser,
];
const syntheticEmails = [
  fixture.staff.email,
  fixture.repreneurs.real.email,
  fixture.repreneurs.demo.email,
];
const syntheticRepreneurIds = [
  fixture.ids.realRepreneur,
  fixture.ids.demoRepreneur,
];
const syntheticOpportunityIds = [
  fixture.ids.realOpportunity,
  fixture.ids.demoOpportunity,
];

function output(value: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function requireCurrentSchema() {
  const { rows } = await client.query<{
    repreneurIsDemo: boolean;
    opportunityIsDemo: boolean;
    namespaceGuard: boolean;
    directUploads: boolean;
    currentClosure: boolean;
  }>(`
    SELECT
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='repreneurs' AND column_name='is_demo') AS "repreneurIsDemo",
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name='is_demo') AS "opportunityIsDemo",
      EXISTS(SELECT 1 FROM pg_proc WHERE proname='w164_match_has_same_namespace') AS "namespaceGuard",
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='private_upload_intents') AS "directUploads",
      EXISTS(SELECT 1 FROM pg_proc WHERE proname='close_opportunity_with_reason') AS "currentClosure"
  `);
  const schema = rows[0];
  const missing = Object.entries(schema ?? {})
    .filter(([, present]) => !present)
    .map(([contract]) => contract);
  if (missing.length > 0) {
    throw new Error(
      `Opening fixture requires the current application schema: ${missing.join(", ")}.`,
    );
  }
}

async function assertFixtureHasNoImmutableJourneyHistory() {
  const { rows } = await client.query<{
    documents: number;
    artifacts: number;
    evidence: number;
    grants: number;
    events: number;
  }>(
    `SELECT
      (SELECT count(*)::int FROM public.opportunity_documents WHERE opportunity_id = ANY($1::uuid[])) AS documents,
      (SELECT count(*)::int FROM public.opportunity_nda_artifacts WHERE opportunity_id = ANY($1::uuid[])) AS artifacts,
      (SELECT count(*)::int FROM public.opportunity_pursuit_evidence WHERE opportunity_id = ANY($1::uuid[])) AS evidence,
      (SELECT count(*)::int FROM public.opportunity_pursuit_confidential_grants WHERE opportunity_id = ANY($1::uuid[])) AS grants,
      (SELECT count(*)::int FROM public.opportunity_pursuit_events WHERE opportunity_id = ANY($1::uuid[])) AS events`,
    [syntheticOpportunityIds],
  );
  const history = rows[0];
  if (Object.values(history ?? {}).some((count) => count > 0)) {
    throw new Error(
      "Opening fixture refuses to erase documents or immutable journey history. Destroy the disposable local Supabase stack after lifecycle proof.",
    );
  }
}

async function cleanupRows() {
  const ids = fixture.ids;
  await client.query(
    "DELETE FROM public.email_logs WHERE repreneur_id = ANY($1::uuid[])",
    [syntheticRepreneurIds],
  );
  await client.query(
    "DELETE FROM public.opportunity_ma_contacts WHERE id = ANY($1::uuid[])",
    [[ids.realOpportunityContact, ids.demoOpportunityContact]],
  );
  await client.query(
    "DELETE FROM public.opportunity_matches WHERE opportunity_id = ANY($1::uuid[]) OR repreneur_id = ANY($2::uuid[])",
    [syntheticOpportunityIds, syntheticRepreneurIds],
  );
  await client.query(
    "DELETE FROM public.app_user_roles WHERE user_id = ANY($1::text[]) OR repreneur_id = ANY($2::uuid[])",
    [syntheticUserIds, syntheticRepreneurIds],
  );
  await client.query(
    'DELETE FROM public."session" WHERE "userId" = ANY($1::text[])',
    [syntheticUserIds],
  );
  await client.query(
    'DELETE FROM public."verification" WHERE "identifier" = ANY($1::text[]) OR "value" = ANY($2::text[])',
    [syntheticEmails, syntheticUserIds],
  );
  await client.query(
    'DELETE FROM public."account" WHERE "userId" = ANY($1::text[])',
    [syntheticUserIds],
  );
  await client.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [
    syntheticUserIds,
  ]);
  await client.query(
    "DELETE FROM public.opportunities WHERE id = ANY($1::uuid[])",
    [syntheticOpportunityIds],
  );
  await client.query(
    "DELETE FROM public.repreneurs WHERE id = ANY($1::uuid[])",
    [syntheticRepreneurIds],
  );
  await client.query(
    "DELETE FROM public.ma_contact_office_affiliations WHERE id = ANY($1::uuid[])",
    [[ids.realAffiliation, ids.demoAffiliation]],
  );
  await client.query(
    "DELETE FROM public.ma_contacts WHERE id = ANY($1::uuid[])",
    [[ids.realContact, ids.demoContact]],
  );
  await client.query(
    "DELETE FROM public.ma_offices WHERE id = ANY($1::uuid[])",
    [[ids.realOffice, ids.demoOffice]],
  );
  await client.query("DELETE FROM public.ma_firms WHERE id = ANY($1::uuid[])", [
    [ids.realFirm, ids.demoFirm],
  ]);
}

async function setup() {
  const ids = fixture.ids;
  const passwordHash = await hashPassword(password);
  await assertFixtureHasNoImmutableJourneyHistory();
  await client.query("BEGIN");
  try {
    await cleanupRows();
    await client.query(
      `INSERT INTO public.ma_firms(id,name,status,created_by) VALUES
        ($1,$2,'active',$3),($4,$5,'active',$3)`,
      [
        ids.realFirm,
        "QA OPENING REAL FIRM — SYNTHETIC",
        fixture.staff.id,
        ids.demoFirm,
        "QA OPENING DEMO FIRM — SYNTHETIC",
      ],
    );
    await client.query(
      `INSERT INTO public.ma_offices(id,firm_id,name,status,city,created_by) VALUES
        ($1,$2,'QA OPENING REAL OFFICE — SYNTHETIC','active','Paris',$3),
        ($4,$5,'QA OPENING DEMO OFFICE — SYNTHETIC','active','Paris',$3)`,
      [
        ids.realOffice,
        ids.realFirm,
        fixture.staff.id,
        ids.demoOffice,
        ids.demoFirm,
      ],
    );
    await client.query(
      `INSERT INTO public.ma_contacts(
        id,first_name,last_name,display_name,status,email,
        campaign_email_suppressed,campaign_email_suppression_reason,created_by
      ) VALUES
        ($1,'QA','Real','QA OPENING REAL CONTACT — SYNTHETIC','active',$2,true,'synthetic opening fixture',$3),
        ($4,'QA','Demo','QA OPENING DEMO CONTACT — SYNTHETIC','active',$5,true,'synthetic opening fixture',$3)`,
      [
        ids.realContact,
        "qa-opening-real-contact@re-new.invalid",
        fixture.staff.id,
        ids.demoContact,
        "qa-opening-demo-contact@re-new.invalid",
      ],
    );
    await client.query(
      `INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES
        ($1,$2,$3,true,$4),($5,$6,$7,true,$4)`,
      [
        ids.realAffiliation,
        ids.realContact,
        ids.realOffice,
        fixture.staff.id,
        ids.demoAffiliation,
        ids.demoContact,
        ids.demoOffice,
      ],
    );
    await client.query(
      `INSERT INTO public.repreneurs(
        id,email,first_name,last_name,lifecycle_status,journey_stage,created_by,is_demo,
        q12_geo_zones,q13_target_sectors_v2,q14_deal_size,q15_structure,q16_equity,
        target_revenue_min_meur,target_revenue_max_meur,target_ebitda_min_keur,
        target_ebitda_max_keur,target_ebitda_margin_min_pct,target_staff_size_min,
        target_staff_size_max,questionnaire_completed_at,needs_data_completion
      ) VALUES
        ($1,$2,'QA','OPENING REAL — SYNTHETIC','client','execution',$3,false,
         '["all-france"]','["Tech & Digital"]','["3-5M"]','["majority_without_fund"]','>450',
         10,50,2000,5000,6,10,250,clock_timestamp(),false),
        ($4,$5,'QA','OPENING DEMO — SYNTHETIC','client','execution',$3,true,
         '["all-france"]','["Tech & Digital"]','["3-5M"]','["majority_without_fund"]','>450',
         10,50,2000,5000,6,10,250,clock_timestamp(),false)`,
      [
        ids.realRepreneur,
        fixture.repreneurs.real.email,
        fixture.staff.id,
        ids.demoRepreneur,
        fixture.repreneurs.demo.email,
      ],
    );
    await client.query(
      `INSERT INTO public."user"(id,name,email,"emailVerified") VALUES
        ($1,$2,$3,true),($4,$5,$6,true),($7,$8,$9,true)`,
      [
        fixture.staff.id,
        fixture.staff.name,
        fixture.staff.email,
        fixture.repreneurs.real.userId,
        "QA OPENING REAL — SYNTHETIC",
        fixture.repreneurs.real.email,
        fixture.repreneurs.demo.userId,
        "QA OPENING DEMO — SYNTHETIC",
        fixture.repreneurs.demo.email,
      ],
    );
    await client.query(
      `INSERT INTO public."account"(
        id,"userId","accountId","providerId",password
      ) VALUES
        ($1,$2,$2,'credential',$7),
        ($3,$4,$4,'credential',$7),
        ($5,$6,$6,'credential',$7)`,
      [
        fixture.authIds.staffAccount,
        fixture.staff.id,
        fixture.authIds.realAccount,
        fixture.repreneurs.real.userId,
        fixture.authIds.demoAccount,
        fixture.repreneurs.demo.userId,
        passwordHash,
      ],
    );
    await client.query(
      `INSERT INTO public.app_user_roles(
        id,user_id,email,role,repreneur_id,access_enabled_at
      ) VALUES
        ($1,$2,$3,'staff',NULL,clock_timestamp()),
        ($4,$5,$6,'repreneur',$7,clock_timestamp()),
        ($8,$9,$10,'repreneur',$11,clock_timestamp())`,
      [
        ids.staffRole,
        fixture.staff.id,
        fixture.staff.email,
        ids.realPortalRole,
        fixture.repreneurs.real.userId,
        fixture.repreneurs.real.email,
        ids.realRepreneur,
        ids.demoPortalRole,
        fixture.repreneurs.demo.userId,
        fixture.repreneurs.demo.email,
        ids.demoRepreneur,
      ],
    );
    await client.query(
      `INSERT INTO public.opportunities(
        id,reference,status,source_office_id,description,public_title,teaser_summary,
        sector,location,revenue_meur,ebitda_keur,headcount,repreneur_exposure,
        is_demo,created_by
      ) VALUES
        ($1,$2,'active',$3,'QA OPENING REAL SYNTHETIC — NEVER COMMERCIAL',
         'QA OPENING REAL — SYNTHETIC','Synthetic opening fixture','Tech & Digital',
         'France',25,3000,80,'anonymized',false,$4),
        ($5,$6,'active',$7,'QA OPENING DEMO SYNTHETIC — NEVER COMMERCIAL',
         'QA OPENING DEMO — SYNTHETIC','Synthetic opening fixture','Tech & Digital',
         'France',25,3000,80,'anonymized',true,$4)`,
      [
        ids.realOpportunity,
        fixture.opportunities.real.reference,
        ids.realOffice,
        fixture.staff.id,
        ids.demoOpportunity,
        fixture.opportunities.demo.reference,
        ids.demoOffice,
      ],
    );
    await client.query(
      `INSERT INTO public.opportunity_ma_contacts(
        id,opportunity_id,affiliation_id,is_primary,is_active,linked_by
      ) VALUES
        ($1,$2,$3,true,true,$4),($5,$6,$7,true,true,$4)`,
      [
        ids.realOpportunityContact,
        ids.realOpportunity,
        ids.realAffiliation,
        fixture.staff.id,
        ids.demoOpportunityContact,
        ids.demoOpportunity,
        ids.demoAffiliation,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  await readback("setup");
}

async function readback(outputCommand: "setup" | "readback" = "readback") {
  const ids = fixture.ids;
  const { rows } = await client.query<OpeningFixtureReadback>(
    `SELECT
      (SELECT count(*)::int FROM public."user" WHERE id=$1 AND lower(email)=lower($2)) AS "staffUser",
      (SELECT count(*)::int FROM public.app_user_roles WHERE id=$3 AND user_id=$1 AND role='staff') AS "staffRole",
      (SELECT count(*)::int FROM public.repreneurs WHERE id=$4 AND is_demo=false) AS "realRepreneur",
      (SELECT count(*)::int FROM public."user" WHERE id=$5 AND lower(email)=lower($6)) AS "realAuthUser",
      (SELECT count(*)::int FROM public.app_user_roles WHERE id=$7 AND user_id=$5 AND repreneur_id=$4 AND role='repreneur') AS "realPortalRole",
      (SELECT count(*)::int FROM public.repreneurs WHERE id=$8 AND is_demo=true) AS "demoRepreneur",
      (SELECT count(*)::int FROM public."user" WHERE id=$9 AND lower(email)=lower($10)) AS "demoAuthUser",
      (SELECT count(*)::int FROM public.app_user_roles WHERE id=$11 AND user_id=$9 AND repreneur_id=$8 AND role='repreneur') AS "demoPortalRole",
      (SELECT count(*)::int FROM public.opportunities WHERE id=$12 AND is_demo=false AND status='active' AND repreneur_exposure='anonymized') AS "realOpportunity",
      (SELECT count(*)::int FROM public.opportunities WHERE id=$13 AND is_demo=true AND status='active' AND repreneur_exposure='anonymized') AS "demoOpportunity",
      (SELECT count(*)::int FROM public.opportunity_matches match
        JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id
        JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
        WHERE (match.opportunity_id = ANY($14::uuid[]) OR match.repreneur_id = ANY($15::uuid[]))
          AND opportunity.is_demo <> repreneur.is_demo) AS "crossNamespaceMatch"`,
    [
      fixture.staff.id,
      fixture.staff.email,
      ids.staffRole,
      ids.realRepreneur,
      fixture.repreneurs.real.userId,
      fixture.repreneurs.real.email,
      ids.realPortalRole,
      ids.demoRepreneur,
      fixture.repreneurs.demo.userId,
      fixture.repreneurs.demo.email,
      ids.demoPortalRole,
      ids.realOpportunity,
      ids.demoOpportunity,
      syntheticOpportunityIds,
      syntheticRepreneurIds,
    ],
  );
  const state = rows[0];
  if (!fixtureReadbackIsHealthy(state)) {
    throw new Error(
      "Opening fixture readback failed identity, lifecycle, or namespace checks.",
    );
  }

  const { rows: credentialRows } = await client.query<{ password: string }>(
    `SELECT password FROM public."account"
     WHERE "userId" = ANY($1::text[]) AND "providerId"='credential'
     ORDER BY "userId"`,
    [syntheticUserIds],
  );
  if (
    credentialRows.length !== syntheticUserIds.length ||
    !(
      await Promise.all(
        credentialRows.map((row) =>
          verifyPassword({ hash: row.password, password }),
        ),
      )
    ).every(Boolean)
  ) {
    throw new Error("Opening fixture credential verification failed.");
  }

  const score = calculateOpportunityMatchScore(
    {
      is_demo: false,
      q12_geo_zones: ["all-france"],
      q13_target_sectors_v2: ["Tech & Digital"],
      target_revenue_min_meur: 10,
      target_revenue_max_meur: 50,
      target_ebitda_min_keur: 2000,
      target_ebitda_max_keur: 5000,
      target_ebitda_margin_min_pct: 6,
      target_staff_size_min: 10,
      target_staff_size_max: 250,
    },
    {
      is_demo: false,
      sector: "Tech & Digital",
      location: "France",
      revenue_meur: 25,
      ebitda_keur: 3000,
      headcount: 80,
    },
  );
  if (score.score !== 100 || score.recommendation !== "strong_fit") {
    throw new Error(
      "Opening fixture no longer produces the expected explainable relevance result.",
    );
  }

  output({
    command: outputCommand,
    runLabel,
    releaseSha,
    ids: fixture.ids,
    authIds: fixture.authIds,
    readback: state,
    matching: score,
    credentialReadback: "two synthetic credentials verified",
    mail: {
      mode: "intercepted allowlist",
      providerCredentialPresent: false,
      recipients: fixture.mailRecipients,
    },
    documents: fixture.documentUploadSlots,
    retention: fixture.retention,
  });
}

async function cleanup() {
  await assertFixtureHasNoImmutableJourneyHistory();
  await client.query("BEGIN");
  try {
    await cleanupRows();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const ids = fixture.ids;
  const { rows } = await client.query<OpeningFixtureCounts>(
    `SELECT
      (SELECT count(*)::int FROM public."user" WHERE id = ANY($1::text[])) AS users,
      (SELECT count(*)::int FROM public."account" WHERE "userId" = ANY($1::text[])) AS accounts,
      (SELECT count(*)::int FROM public."session" WHERE "userId" = ANY($1::text[])) AS sessions,
      (SELECT count(*)::int FROM public."verification" WHERE "identifier" = ANY($9::text[]) OR "value" = ANY($1::text[])) AS verifications,
      (SELECT count(*)::int FROM public.app_user_roles WHERE user_id = ANY($1::text[]) OR repreneur_id = ANY($2::uuid[])) AS roles,
      (SELECT count(*)::int FROM public.repreneurs WHERE id = ANY($2::uuid[])) AS repreneurs,
      (SELECT count(*)::int FROM public.opportunities WHERE id = ANY($3::uuid[])) AS opportunities,
      (SELECT count(*)::int FROM public.opportunity_matches WHERE opportunity_id = ANY($3::uuid[]) OR repreneur_id = ANY($2::uuid[])) AS matches,
      (SELECT count(*)::int FROM public.ma_firms WHERE id = ANY($4::uuid[])) AS firms,
      (SELECT count(*)::int FROM public.ma_offices WHERE id = ANY($5::uuid[])) AS offices,
      (SELECT count(*)::int FROM public.ma_contacts WHERE id = ANY($6::uuid[])) AS contacts,
      (SELECT count(*)::int FROM public.ma_contact_office_affiliations WHERE id = ANY($7::uuid[])) AS affiliations,
      (SELECT count(*)::int FROM public.opportunity_ma_contacts WHERE id = ANY($8::uuid[])) AS "opportunityContacts",
      (SELECT count(*)::int FROM public.email_logs WHERE repreneur_id = ANY($2::uuid[])) AS "emailLogs",
      (SELECT count(*)::int FROM public.opportunity_documents WHERE opportunity_id = ANY($3::uuid[])) AS documents,
      (SELECT count(*)::int FROM public.private_upload_intents WHERE resource_id = ANY($3::uuid[])) AS "uploadIntents",
      (SELECT count(*)::int FROM public.private_upload_cleanup_queue queue
        JOIN public.private_upload_intents intent ON intent.id=queue.intent_id
        WHERE intent.resource_id = ANY($3::uuid[])) AS "uploadCleanupQueue",
      (SELECT count(*)::int FROM storage.objects) AS "storageObjects"`,
    [
      syntheticUserIds,
      syntheticRepreneurIds,
      syntheticOpportunityIds,
      [ids.realFirm, ids.demoFirm],
      [ids.realOffice, ids.demoOffice],
      [ids.realContact, ids.demoContact],
      [ids.realAffiliation, ids.demoAffiliation],
      [ids.realOpportunityContact, ids.demoOpportunityContact],
      syntheticEmails,
    ],
  );
  const residue = rows[0];
  if (!fixtureResidueIsZero(residue)) {
    throw new Error("Opening fixture cleanup left residue.");
  }
  output({ command: "cleanup", runLabel, releaseSha, residue });
}

async function main() {
  await client.connect();
  try {
    await requireCurrentSchema();
    if (command === "setup") await setup();
    if (command === "readback") await readback();
    if (command === "cleanup") await cleanup();
  } finally {
    await client.end();
  }
}

void main();
