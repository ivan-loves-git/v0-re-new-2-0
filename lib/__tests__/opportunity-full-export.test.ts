import { describe, expect, it } from "vitest"
import { fullOpportunitySnapshotToCsv } from "@/lib/utils/opportunity-full-export"

function readCsv(csv: string): Record<string, string>[] {
  const records: string[][] = []
  let record: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"'
        index += 1
      } else quoted = !quoted
    } else if (!quoted && (character === "," || character === "\n")) {
      record.push(cell)
      cell = ""
      if (character === "\n") {
        records.push(record)
        record = []
      }
    } else if (character !== "\r" || quoted) cell += character
  }
  record.push(cell)
  records.push(record)
  const [headers, ...rows] = records
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]])),
  )
}

describe("confirmed full opportunity export", () => {
  it("exports versioned pursuit facts without rollback snapshots or raw source cells", () => {
    const [row] = readCsv(fullOpportunitySnapshotToCsv({
      opportunities: [{ id: "opp-1", status: "active", is_demo: false }],
      matches: [{ id: "match-1", opportunity_id: "opp-1", repreneur_id: "buyer-1", status: "draft" }],
      workbookHistory: [{ id: "history-1", match_id: "match-1", source_sha256: "v4-source", source_row: 3,
        last_reported_source_stage: "info_memo_received", source_terminal: true, raw_drop_reason: "Withdrawal",
        import_match_before: { human_notes: "Secret before-image" }, source_cells: { private: "Raw cell" } }],
    }))
    const history = JSON.parse(row.pursuit_workbook_history_json)
    expect(history[0]).toMatchObject({ source_sha256: "v4-source", source_row: 3, raw_drop_reason: "Withdrawal" })
    expect(history[0]).not.toHaveProperty("import_match_before")
    expect(history[0]).not.toHaveProperty("source_cells")
  })
  it("keeps each match on its own row and retains an unmatched opportunity", () => {
    const rows = readCsv(
      fullOpportunitySnapshotToCsv({
        opportunities: [
          {
            id: "opportunity-a",
            reference: "FR-001",
            status: "active",
            is_demo: false,
          },
          {
            id: "opportunity-b",
            reference: "FR-002",
            status: "draft",
            is_demo: false,
          },
        ],
        matches: [
          {
            id: "match-1",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-1",
            status: "proposed",
          },
          {
            id: "match-2",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-2",
            status: "dropped",
          },
        ],
      }),
    )

    expect(
      rows.map((row) => [
        row.opportunity_id,
        row.opportunity_reference,
        row.pursuit_id,
        row.pursuit_status,
      ]),
    ).toEqual([
      ["opportunity-a", "FR-001", "match-1", "proposed"],
      ["opportunity-a", "FR-001", "match-2", "dropped"],
      ["opportunity-b", "FR-002", "", ""],
    ])
  })

  it("carries the full opportunity and match contract without turning legacy content into public content", () => {
    const [row] = readCsv(
      fullOpportunitySnapshotToCsv({
        opportunities: [
          {
            id: "opportunity-a",
            reference: "FR-001",
            status: "closed",
            is_demo: false,
            description: "Retained internal description",
            teaser_summary: "Approved public summary",
            source_label: "Retained source wording",
            source_visibility: "staff_only",
            anonymized_description: "Earlier summary",
            staff_notes: "Earlier staff note",
            internal_notes: "Current internal note",
            headcount: 0,
            revenue_meur: 0,
            ebitda_keur: null,
            geography_node_id: "geo-1",
            source_identity_to_verify: true,
            demo_classification_created_by: "staff-1",
            demo_classification_updated_at: null,
          },
        ],
        matches: [
          {
            id: "match-1",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-1",
            status: "completed",
            platform_score: 0,
            platform_recommendation: "not_evaluated",
            human_recommendation: "strong_fit",
            human_notes: "Staff accepted",
            pursuit_stage: "closed",
            pursuit_stage_notes: "Sale completed",
            nda_status: "signed",
            nda_signed_at: "2026-08-03T10:00:00Z",
            recommendation_expires_at: "2026-08-04T10:00:00Z",
            recommendation_renewed_by: "staff-2",
          },
        ],
      }),
    )
    const opportunityFields = [
      "id",
      "reference",
      "status",
      "legacy_source_id",
      "legacy_source_label",
      "legacy_source_visibility",
      "sector",
      "activity",
      "location",
      "description",
      "revenue_meur",
      "ebitda_keur",
      "headcount",
      "date_added",
      "legacy_repreneur_visibility",
      "public_title",
      "legacy_anonymized_description",
      "legacy_staff_notes",
      "imported_from",
      "imported_at",
      "archived_at",
      "created_by",
      "created_at",
      "updated_at",
      "headcount_range",
      "repreneur_exposure",
      "teaser_summary",
      "internal_notes",
      "source_office_id",
      "updated_by",
      "date_added_precision",
      "geography_node_id",
      "is_demo",
      "source_identity_to_verify",
      "demo_classification_created_by",
      "demo_classification_created_at",
      "demo_classification_updated_at",
      "demo_classification_updated_by",
    ]
    const pursuitFields = [
      "id",
      "opportunity_id",
      "repreneur_id",
      "status",
      "platform_recommendation",
      "platform_score",
      "platform_reasons",
      "human_recommendation",
      "human_notes",
      "created_by",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at",
      "pursuit_stage",
      "pursuit_stage_notes",
      "pursuit_stage_updated_by",
      "pursuit_stage_updated_at",
      "nda_status",
      "nda_document_id",
      "nda_notes",
      "nda_updated_by",
      "nda_updated_at",
      "decline_reason_categories",
      "decline_reason_text",
      "interest_expressed_at",
      "interest_notification_sent_at",
      "nda_received_at",
      "nda_signed_at",
      "nda_waived_at",
      "nda_waived_by",
      "recommendation_published_at",
      "recommendation_expires_at",
      "recommendation_renewed_at",
      "recommendation_renewed_by",
    ]
    expect(Object.keys(row)).toEqual(
      expect.arrayContaining([
        ...opportunityFields.map((field) => `opportunity_${field}`),
        ...pursuitFields.map((field) => `pursuit_${field}`),
      ]),
    )
    expect(row).toMatchObject({
      opportunity_description: "Retained internal description",
      opportunity_teaser_summary: "Approved public summary",
      opportunity_legacy_source_label: "Retained source wording",
      opportunity_legacy_anonymized_description: "Earlier summary",
      opportunity_legacy_staff_notes: "Earlier staff note",
      opportunity_internal_notes: "Current internal note",
      opportunity_headcount: "0",
      opportunity_revenue_meur: "0",
      opportunity_ebitda_keur: "",
      opportunity_is_demo: "false",
      opportunity_source_identity_to_verify: "true",
      opportunity_demo_classification_created_by: "staff-1",
      opportunity_demo_classification_updated_at: "",
      pursuit_platform_score: "0",
      pursuit_human_recommendation: "strong_fit",
      pursuit_human_notes: "Staff accepted",
      pursuit_pursuit_stage: "closed",
      pursuit_pursuit_stage_notes: "Sale completed",
      pursuit_nda_signed_at: "2026-08-03T10:00:00Z",
      pursuit_recommendation_expires_at: "2026-08-04T10:00:00Z",
      pursuit_recommendation_renewed_by: "staff-2",
    })
  })

  it("round-trips spreadsheet text, arrays, negative metrics and month-only dates safely", () => {
    const [row] = readCsv(
      fullOpportunitySnapshotToCsv({
        opportunities: [
          {
            id: "opportunity-a",
            reference: "FR-001",
            status: "active",
            is_demo: false,
            public_title: 'Société, "énergie"',
            description: "First line\r\nSecond line",
            internal_notes: '=HYPERLINK("https://example.invalid")',
            source_label: "\t@SUM(1+1)",
            activity: "+SUM(1+1)",
            location: "-CMD",
            sector: "Normal text",
            date_added: "2026-05-01",
            date_added_precision: "month",
            ebitda_keur: -12.5,
          },
        ],
        matches: [
          {
            id: "match-1",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-1",
            status: "declined",
            platform_reasons: ["Review, not rejected", "Missing\nmargin"],
            decline_reason_categories: [],
          },
        ],
      }),
    )
    expect(row).toMatchObject({
      opportunity_public_title: 'Société, "énergie"',
      opportunity_description: "First line\r\nSecond line",
      opportunity_internal_notes: '\'=HYPERLINK("https://example.invalid")',
      opportunity_legacy_source_label: "'\t@SUM(1+1)",
      opportunity_activity: "'+SUM(1+1)",
      opportunity_location: "'-CMD",
      opportunity_sector: "Normal text",
      opportunity_ebitda_keur: "-12.5",
      opportunity_date_added: "2026-05",
      opportunity_date_added_precision: "month",
      pursuit_platform_reasons: '["Review, not rejected","Missing\\nmargin"]',
      pursuit_decline_reason_categories: "[]",
    })
  })

  it("binds identities and every retained stage event to the exact pursuit without multiplying rows", () => {
    const rows = readCsv(
      fullOpportunitySnapshotToCsv({
        opportunities: [
          {
            id: "opportunity-a",
            reference: "FR-001",
            status: "active",
            is_demo: false,
          },
          {
            id: "opportunity-b",
            reference: "FR-002",
            status: "draft",
            is_demo: true,
          },
        ],
        matches: [
          {
            id: "match-1",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-1",
            status: "active_pursuit",
            pursuit_stage: "loi",
          },
          {
            id: "match-2",
            opportunity_id: "opportunity-a",
            repreneur_id: "buyer-2",
            status: "dropped",
          },
        ],
        repreneurs: [
          {
            id: "buyer-1",
            first_name: "Ada",
            last_name: "Example",
            email: "ada@example.invalid",
            phone: "+33000000001",
            is_demo: false,
            journey_stage: "pursuit",
          },
          {
            id: "buyer-2",
            first_name: "Demo",
            last_name: "Example",
            email: "demo@example.invalid",
            is_demo: true,
          },
        ],
        sources: [
          {
            opportunity_id: "opportunity-a",
            firm_id: "firm-1",
            firm_name: "Advisory Firm",
            office_id: "office-1",
            office_name: "Paris",
            legacy_firm_name: "Retained legacy firm",
          },
        ],
        contacts: [
          {
            id: "contact-link-1",
            opportunity_id: "opportunity-a",
            affiliation_id: "old-affiliation",
            is_active: false,
            is_primary: true,
            contact_name_snapshot: "Former intermediary",
            contact_email_snapshot: "former@example.invalid",
          },
        ],
        pursuitEvents: [
          {
            id: "event-2",
            opportunity_id: "opportunity-a",
            match_id: "match-1",
            repreneur_id: "buyer-1",
            stage: "loi",
            note: "Actual second event",
            created_at: "2026-08-05T10:00:00Z",
          },
          {
            id: "event-1",
            opportunity_id: "opportunity-a",
            match_id: "match-1",
            repreneur_id: "buyer-1",
            stage: "interest",
            note: "Actual first event",
            created_at: "2026-08-01T10:00:00Z",
          },
          {
            id: "wrong-opportunity",
            opportunity_id: "opportunity-b",
            match_id: "match-1",
            repreneur_id: "buyer-1",
            stage: "closed",
            note: "Wrong opportunity",
          },
          {
            id: "wrong-repreneur",
            opportunity_id: "opportunity-a",
            match_id: "match-1",
            repreneur_id: "buyer-2",
            stage: "closed",
            note: "Wrong repreneur",
          },
        ],
      }),
    )

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      repreneur_first_name: "Ada",
      repreneur_email: "ada@example.invalid",
      repreneur_phone: "'+33000000001",
      repreneur_journey_stage: "pursuit",
      repreneur_is_demo: "false",
      pursuit_namespace_status: "same_namespace",
      source_firm_name: "Advisory Firm",
      source_office_name: "Paris",
      source_legacy_firm_name: "Retained legacy firm",
      opportunity_pipeline_status: "LOI",
    })
    expect(JSON.parse(rows[0].opportunity_contacts_json)).toEqual([
      expect.objectContaining({
        is_active: false,
        contact_email_snapshot: "former@example.invalid",
      }),
    ])
    expect(
      JSON.parse(rows[0].pursuit_stage_history_json).map(
        (event: { id: string }) => event.id,
      ),
    ).toEqual(["event-1", "event-2"])
    expect(rows[1]).toMatchObject({
      repreneur_first_name: "Demo",
      pursuit_namespace_status: "historical_mismatch",
      pursuit_stage_history_json: "[]",
    })
    expect(rows[2]).toMatchObject({
      repreneur_first_name: "",
      pursuit_namespace_status: "",
      pursuit_stage_history_json: "",
    })
  })
  it("exports recorded document and confidentiality history without file capabilities or transport secrets", () => {
    const csv = fullOpportunitySnapshotToCsv({
      opportunities: [
        { id: "opp", reference: "FR-001", status: "active", is_demo: false },
      ],
      matches: [
        {
          id: "match",
          opportunity_id: "opp",
          repreneur_id: "buyer",
          status: "active_pursuit",
        },
      ],
      documents: [
        {
          id: "doc",
          opportunity_id: "opp",
          title: "Signed NDA",
          file_name: "signed.pdf",
          size_bytes: 120,
          storage_path: "SECRET_PATH",
          external_url: "SECRET_URL",
        },
      ],
      ndaArtifacts: [
        {
          id: "artifact",
          opportunity_id: "opp",
          match_id: "match",
          document_id: "doc",
          artifact_role: "repreneur_signed",
          version_number: 2,
          content_sha256: "version-hash",
        },
      ],
      evidence: [
        {
          id: "evidence",
          opportunity_id: "opp",
          match_id: "match",
          repreneur_id: "buyer",
          event_type: "e7_memo_dispatched",
          metadata: {
            source_firm_name: "Firm",
            historical_revalidation: false,
            attachment_snapshot: [
              {
                document_id: "doc",
                file_name: "signed.pdf",
                storage_path: "SECRET_NESTED",
              },
            ],
            operation_key: "SECRET_KEY",
            provider_message_id: "SECRET_PROVIDER",
            unknown: "SECRET_UNKNOWN",
          },
          idempotency_key: "SECRET_IDEMPOTENCY",
        },
        {
          id: "foreign",
          opportunity_id: "elsewhere",
          match_id: "match",
          repreneur_id: "buyer",
          event_type: "e7_memo_dispatched",
        },
      ],
      grants: [
        {
          id: "grant",
          opportunity_id: "opp",
          match_id: "match",
          revoked_at: "2026-09-01T10:00:00Z",
          disclosed_contacts: [{ name: "Contact", token: "SECRET_CONTACT" }],
        },
      ],
      handoffs: [
        {
          id: "handoff",
          match_id: "match",
          handoff_type: "memo",
          delivery_status: "sent",
          attempt_count: 2,
          attachment_snapshot: [
            { artifact_id: "artifact", file_name: "signed.pdf" },
          ],
          prior_attempts: [{ provider_message_id: "SECRET_PRIOR" }],
          delivery_error: "SECRET_ERROR",
        },
      ],
      memoNotifications: [
        {
          id: "memo",
          match_id: "match",
          opportunity_id: "opp",
          repreneur_id: "buyer",
          recipient_email: "buyer@example.invalid",
          status: "sent",
          provider_id: "SECRET_MEMO",
        },
      ],
      assignmentNotifications: [
        {
          id: "assignment",
          match_id: "match",
          recipient_email: "buyer@example.invalid",
          public_title: "Original public title",
          teaser_summary: "Original teaser",
        },
      ],
      closures: [
        {
          id: "closure",
          opportunity_id: "opp",
          reason: "sold",
          closed_at: "2026-08-01T10:00:00Z",
        },
      ],
      pauses: [
        {
          id: "pause",
          opportunity_id: "opp",
          reason: "Seller requested pause",
          paused_at: "2026-07-01T10:00:00Z",
        },
      ],
      interactions: [
        {
          id: "interaction",
          opportunity_id: "opp",
          title: "Recorded handoff",
          body_markdown: "Sent business wording",
          delivery_status: "sent",
          provider_idempotency_key: "SECRET_INTERACTION",
        },
      ],
    })
    const [row] = readCsv(csv)
    expect(JSON.parse(row.opportunity_documents_json)).toEqual([
      {
        id: "doc",
        opportunity_id: "opp",
        title: "Signed NDA",
        file_name: "signed.pdf",
        size_bytes: 120,
      },
    ])
    expect(JSON.parse(row.pursuit_nda_artifacts_json)[0]).toMatchObject({
      version_number: 2,
      content_sha256: "version-hash",
    })
    expect(JSON.parse(row.pursuit_evidence_json)).toEqual([
      {
        id: "evidence",
        opportunity_id: "opp",
        match_id: "match",
        repreneur_id: "buyer",
        event_type: "e7_memo_dispatched",
        metadata: {
          source_firm_name: "Firm",
          historical_revalidation: false,
          attachment_snapshot: [
            { document_id: "doc", file_name: "signed.pdf" },
          ],
        },
      },
    ])
    expect(JSON.parse(row.pursuit_confidential_grants_json)[0]).toMatchObject({
      revoked_at: "2026-09-01T10:00:00Z",
      disclosed_contacts: [{ name: "Contact" }],
    })
    expect(JSON.parse(row.pursuit_handoff_deliveries_json)[0]).toMatchObject({
      delivery_status: "sent",
      attempt_count: 2,
      attachment_snapshot: [
        { artifact_id: "artifact", file_name: "signed.pdf" },
      ],
    })
    expect(JSON.parse(row.pursuit_memo_notifications_json)[0].status).toBe(
      "sent",
    )
    expect(
      JSON.parse(row.pursuit_assignment_notifications_json)[0].teaser_summary,
    ).toBe("Original teaser")
    expect(JSON.parse(row.opportunity_closure_history_json)[0].reason).toBe(
      "sold",
    )
    expect(JSON.parse(row.opportunity_pause_history_json)[0].reason).toBe(
      "Seller requested pause",
    )
    expect(JSON.parse(row.opportunity_interactions_json)[0].body_markdown).toBe(
      "Sent business wording",
    )
    expect(csv).not.toContain("SECRET_")
    expect(readCsv(csv)).toHaveLength(1)
  })

  it("retains legacy source-contact snapshots separately from current canonical contacts", () => {
    const [row] = readCsv(
      fullOpportunitySnapshotToCsv({
        opportunities: [
          {
            id: "opp",
            reference: "FR-001",
            status: "archived",
            is_demo: false,
          },
        ],
        matches: [],
        legacyContacts: [
          {
            opportunity_id: "opp",
            source_id: "legacy-firm",
            contact_id: "contact",
            contact_name_snapshot: "Original intermediary",
            contact_email_snapshot: "original@example.invalid",
            current_contact_name: "Current name",
            canonical_opportunity_contact_id: "canonical-link",
            created_at: "2026-01-01T10:00:00Z",
          },
          {
            opportunity_id: "other",
            contact_id: "foreign",
            contact_name_snapshot: "Wrong opportunity",
          },
        ],
      }),
    )
    expect(JSON.parse(row.opportunity_legacy_contacts_json)).toEqual([
      expect.objectContaining({
        contact_id: "contact",
        contact_name_snapshot: "Original intermediary",
        current_contact_name: "Current name",
        canonical_opportunity_contact_id: "canonical-link",
      }),
    ])
    expect(row.opportunity_contacts_json).toBe("[]")
  })
})
