# PostgreSQL TLS trust

The application and operational scripts pin Supabase Root 2021 CA, a public
trust anchor published by Supabase for database TLS. The authoritative
[Supabase SSL-enforcement guidance](https://supabase.com/docs/guides/platform/ssl-enforcement)
instructs an operator to download `prod-ca-2021.crt` from the project's
**Database Settings**. The protected WAVE workflow retrieves the same
certificate from the approved Supabase download endpoint:
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

The checked-in certificate is a CA certificate with subject and issuer
`CN=Supabase Root 2021 CA, O=Supabase Inc, L=New Castle, ST=Delware, C=US`.
Its SHA-256 fingerprint is
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`,
and its validity is 2021-04-28 through 2031-04-26. It is source-controlled
trust material, never an environment secret; database URLs and credentials
remain secrets.

Before a Supabase CA rotation or the expiry date, download the replacement
from the project's Database Settings (or the approved endpoint), calculate its
SHA-256 fingerprint, and fail the release preparation if it differs from the
approved replacement fingerprint. Verify that replacement against Supabase's
published database TLS guidance, update the pinned value, provenance record,
and fingerprint test together, then release through the normal Gate 2 process.
Remote connections fail closed with hostname and chain verification; loopback
is not an operational exception in this configuration.
