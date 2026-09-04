#!/usr/bin/env tsx

/**
 * Exercises the application's real mail boundary in protected fixture mode.
 * The Resend adapter must accept the allowlisted synthetic envelopes without a
 * provider credential or network delivery. No message body or token is kept.
 */
import { FROM_EMAIL, FROM_NAME, resend } from "../lib/email/resend-client";
import { OPENING_READINESS_FIXTURE } from "../lib/opening-readiness-fixture";

if (
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected" ||
  process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RESEND_API_KEY
) {
  throw new Error(
    "Opening fixture mail proof requires protected GitHub Actions mode.",
  );
}

async function main() {
  const recipients = [
    OPENING_READINESS_FIXTURE.repreneurs.real.email,
    OPENING_READINESS_FIXTURE.repreneurs.demo.email,
  ];

  for (const recipient of recipients) {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipient,
      subject: "QA OPENING SYNTHETIC — NO DELIVERY",
      text: "Synthetic fixture mail-boundary proof.",
    });
    if (result.error || result.data?.id !== "qa-allowlist-accepted") {
      throw new Error(
        "Opening fixture mail adapter did not use the protected no-send path.",
      );
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      mode: "protected-allowlist",
      providerCredentialPresent: false,
      providerNetworkCall: false,
      acceptedSyntheticEnvelopes: recipients.length,
    })}\n`,
  );
}

void main();
