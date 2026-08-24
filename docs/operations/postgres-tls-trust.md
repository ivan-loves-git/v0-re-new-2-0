# PostgreSQL TLS trust

The application and operational scripts pin Supabase Root 2021 CA, a public
trust anchor published by Supabase for database TLS. It is source-controlled
trust material, never an environment secret; database URLs and credentials
remain secrets.

The certificate expires in April 2031. Before a Supabase CA rotation or the
expiry date, verify the replacement against Supabase's published database TLS
guidance, update the pinned value and tests together, then release through the
normal Gate 2 process. Remote connections fail closed with hostname and chain
verification; loopback is not an operational exception in this configuration.
