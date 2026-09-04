export type OpeningFixtureCounts = {
  users: number;
  accounts: number;
  sessions: number;
  verifications: number;
  roles: number;
  repreneurs: number;
  opportunities: number;
  matches: number;
  firms: number;
  offices: number;
  contacts: number;
  affiliations: number;
  opportunityContacts: number;
  emailLogs: number;
  documents: number;
  uploadIntents: number;
  uploadCleanupQueue: number;
  storageObjects: number;
};

export type OpeningFixtureReadback = {
  staffUser: number;
  staffRole: number;
  realRepreneur: number;
  realAuthUser: number;
  realPortalRole: number;
  demoRepreneur: number;
  demoAuthUser: number;
  demoPortalRole: number;
  realOpportunity: number;
  demoOpportunity: number;
  crossNamespaceMatch: number;
};

const UUIDS = {
  realRepreneur: "93000000-0000-4000-8000-000000000011",
  demoRepreneur: "93000000-0000-4000-8000-000000000012",
  realOpportunity: "93000000-0000-4000-8000-000000000021",
  demoOpportunity: "93000000-0000-4000-8000-000000000022",
  realFirm: "93000000-0000-4000-8000-000000000041",
  demoFirm: "93000000-0000-4000-8000-000000000042",
  realOffice: "93000000-0000-4000-8000-000000000051",
  demoOffice: "93000000-0000-4000-8000-000000000052",
  realContact: "93000000-0000-4000-8000-000000000061",
  demoContact: "93000000-0000-4000-8000-000000000062",
  realAffiliation: "93000000-0000-4000-8000-000000000071",
  demoAffiliation: "93000000-0000-4000-8000-000000000072",
  realOpportunityContact: "93000000-0000-4000-8000-000000000081",
  demoOpportunityContact: "93000000-0000-4000-8000-000000000082",
  staffRole: "93000000-0000-4000-8000-000000000090",
  realPortalRole: "93000000-0000-4000-8000-000000000091",
  demoPortalRole: "93000000-0000-4000-8000-000000000092",
} as const;

const AUTH_IDS = {
  staffUser: "qa-opening-staff-user",
  realUser: "qa-opening-real-user",
  demoUser: "qa-opening-demo-user",
  staffAccount: "qa-opening-staff-account",
  realAccount: "qa-opening-real-account",
  demoAccount: "qa-opening-demo-account",
} as const;

export const OPENING_READINESS_FIXTURE = {
  databaseName: "postgres",
  databasePort: "54322",
  ids: UUIDS,
  authIds: AUTH_IDS,
  staff: {
    id: AUTH_IDS.staffUser,
    email: "qa-opening-staff@re-new.invalid",
    name: "QA OPENING STAFF — SYNTHETIC",
  },
  repreneurs: {
    real: {
      id: UUIDS.realRepreneur,
      userId: AUTH_IDS.realUser,
      email: "qa-opening-real@re-new.invalid",
      isDemo: false,
    },
    demo: {
      id: UUIDS.demoRepreneur,
      userId: AUTH_IDS.demoUser,
      email: "qa-opening-demo@re-new.invalid",
      isDemo: true,
    },
  },
  opportunities: {
    real: {
      id: UUIDS.realOpportunity,
      reference: "QA-OPENING-REAL",
      isDemo: false,
    },
    demo: {
      id: UUIDS.demoOpportunity,
      reference: "QA-OPENING-DEMO",
      isDemo: true,
    },
  },
  mailRecipients: [
    "qa-opening-real@re-new.invalid",
    "qa-opening-demo@re-new.invalid",
    "qa-opening-real-contact@re-new.invalid",
    "qa-opening-demo-contact@re-new.invalid",
  ],
  documentUploadSlots: ["blank NDA", "Information Memorandum"] as const,
  retention:
    "one disposable CI run; the entire local Supabase stack is destroyed after proof",
} as const;

export function openingReadinessRunLabel(releaseSha: string): string {
  if (!/^[a-f0-9]{40}$/i.test(releaseSha))
    throw new Error("Opening fixture requires a full application SHA.");
  return `qa-opening-${releaseSha.slice(0, 8).toLowerCase()}`;
}

function parseLocalUrl(value: string, label: string): URL {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error(`Opening fixture ${label} is invalid.`);
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
    throw new Error(`Opening fixture ${label} must be loopback.`);
  }
  return target;
}

export function assertOpeningReadinessFixtureEnvironment(
  env: Record<string, string | undefined>,
): { databaseUrl: URL; apiUrl: URL } {
  if (env.CI !== "true" || env.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Opening fixture is restricted to a disposable GitHub Actions runner.",
    );
  }
  if (env.QA_FIXTURE_MODE !== "local") {
    throw new Error("Opening fixture requires QA_FIXTURE_MODE=local.");
  }
  if (env.QA_CONTRACT_MODE !== "protected") {
    throw new Error("Opening fixture requires QA_CONTRACT_MODE=protected.");
  }
  if (env.RESEND_API_KEY) {
    throw new Error(
      "Opening fixture refuses a configured outbound email provider.",
    );
  }
  if (env.QA_MAIL_MODE !== "allowlist") {
    throw new Error(
      "Opening fixture requires intercepted allowlist mail mode.",
    );
  }
  const allowedRecipients = new Set(
    (env.QA_EMAIL_RECIPIENT ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    OPENING_READINESS_FIXTURE.mailRecipients.some(
      (recipient) => !allowedRecipients.has(recipient),
    )
  ) {
    throw new Error("Opening fixture mail allowlist is incomplete.");
  }

  const databaseUrl = parseLocalUrl(
    env.OPENING_FIXTURE_DATABASE_URL ?? "",
    "database URL",
  );
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("Opening fixture requires a PostgreSQL URL.");
  }
  if (
    databaseUrl.pathname.replace(/^\//, "") !==
      OPENING_READINESS_FIXTURE.databaseName ||
    databaseUrl.port !== OPENING_READINESS_FIXTURE.databasePort
  ) {
    throw new Error(
      `Opening fixture database must be local ${OPENING_READINESS_FIXTURE.databaseName} on port ${OPENING_READINESS_FIXTURE.databasePort}.`,
    );
  }

  const apiUrl = parseLocalUrl(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    "Supabase API URL",
  );
  if (apiUrl.protocol !== "http:") {
    throw new Error("Opening fixture Supabase API must use local HTTP.");
  }
  return { databaseUrl, apiUrl };
}

export function fixtureReadbackIsHealthy(
  readback: OpeningFixtureReadback,
): boolean {
  return (
    readback.staffUser === 1 &&
    readback.staffRole === 1 &&
    readback.realRepreneur === 1 &&
    readback.realAuthUser === 1 &&
    readback.realPortalRole === 1 &&
    readback.demoRepreneur === 1 &&
    readback.demoAuthUser === 1 &&
    readback.demoPortalRole === 1 &&
    readback.realOpportunity === 1 &&
    readback.demoOpportunity === 1 &&
    readback.crossNamespaceMatch === 0
  );
}

export function fixtureResidueIsZero(counts: OpeningFixtureCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}
