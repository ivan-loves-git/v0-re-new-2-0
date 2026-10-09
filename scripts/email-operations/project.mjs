// Public service identities from the approved #247 release, not credentials.
export const PROJECT = Object.freeze({
  name: "Re-New",
  appOrigin: "https://app.re-new.team",
  sourceUrl: "https://iiuqcdnmxhtyispnykgf.supabase.co",
  vercelProjectId: "prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c",
  vercelTeamId: "team_ZBRRlhayqlLIURUcxtq6pky0",
  businessDomain: { id: "e39154e8-80d9-4ace-9d2b-92bec7a81762", name: "news.re-new.team" },
  accessDomain: { id: "07954ee8-5bd0-4dff-bbcb-f8bb5ea39a8b", name: "access.re-new.team" },
  businessCc: ["bertrand@re-new.team", "contact@re-new.team"],
})

export function sourceMatches(env) {
  return env.NEXT_PUBLIC_SUPABASE_URL === PROJECT.sourceUrl
}
