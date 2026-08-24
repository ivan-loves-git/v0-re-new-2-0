import "server-only"

import { X509Certificate } from "node:crypto"
import { checkServerIdentity, type PeerCertificate } from "node:tls"
import { Pool, type PoolConfig } from "pg"
import { env } from "@/lib/env"

// Supabase's public production root CA, already exercised by the protected QA
// lane. Keeping it with the server code avoids a second production secret or
// a runtime network dependency while still pinning the database trust root.
export const SUPABASE_ROOT_CA_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`

export function assertCertificateAuthority(pem: string) {
  try {
    const certificate = new X509Certificate(pem)
    if (!certificate.ca) throw new Error("not-ca")
    return pem
  } catch {
    throw new Error(
      "The configured PostgreSQL certificate authority is invalid.",
    )
  }
}

const trustedDatabaseCa = assertCertificateAuthority(SUPABASE_ROOT_CA_2021)

export function createHardenedPostgresPoolConfig(
  connectionString: string,
  max = 5,
): PoolConfig {
  let databaseUrl: URL
  try {
    databaseUrl = new URL(connectionString)
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.")
  }

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.")
  }
  if (!databaseUrl.hostname) {
    throw new Error("DATABASE_URL must include a database hostname.")
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new Error("PostgreSQL pool size must be a positive integer.")
  }

  // Parse the URL into discrete fields. Passing connectionString together with
  // an ssl object lets sslmode/sslrootcert query parameters replace that object
  // in node-postgres, which could silently disable this verification boundary.
  return {
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || "5432"),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.slice(1)) || "postgres",
    max,
    ssl: {
      ca: trustedDatabaseCa,
      rejectUnauthorized: true,
      servername: databaseUrl.hostname,
      checkServerIdentity: (hostname: string, certificate: PeerCertificate) =>
        checkServerIdentity(hostname, certificate),
    },
  }
}

let applicationPool: Pool | null = null

export function getApplicationPostgresPool() {
  if (!applicationPool) {
    applicationPool = new Pool(
      createHardenedPostgresPoolConfig(env.DATABASE_URL),
    )
  }
  return applicationPool
}
