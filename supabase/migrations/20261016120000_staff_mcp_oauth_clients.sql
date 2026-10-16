-- Staff Claude connection (#265): Better Auth MCP plugin storage for OAuth
-- clients, access/refresh tokens and consents. Additive only; no existing
-- table or row changes. Better Auth reaches these tables through its own
-- database connection, so no API role (including service_role) may read them:
-- tokens never travel through the Data API or the staff data connection.
BEGIN;

CREATE TABLE public."oauthApplication" (
  "id" text PRIMARY KEY,
  "name" text,
  "icon" text,
  "metadata" text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectUrls" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean DEFAULT false,
  "userId" text REFERENCES public."user"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."oauthAccessToken" (
  "id" text PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamptz NOT NULL,
  "refreshTokenExpiresAt" timestamptz NOT NULL,
  "clientId" text NOT NULL
    REFERENCES public."oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES public."user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "oauthAccessToken_clientId_idx" ON public."oauthAccessToken" ("clientId");
CREATE INDEX "oauthAccessToken_userId_idx" ON public."oauthAccessToken" ("userId");

CREATE TABLE public."oauthConsent" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL
    REFERENCES public."oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES public."user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "consentGiven" boolean NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "oauthConsent_clientId_idx" ON public."oauthConsent" ("clientId");
CREATE INDEX "oauthConsent_userId_idx" ON public."oauthConsent" ("userId");

ALTER TABLE public."oauthApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."oauthAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."oauthConsent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."oauthApplication", public."oauthAccessToken", public."oauthConsent"
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
