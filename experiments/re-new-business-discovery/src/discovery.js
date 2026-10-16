/**
 * Fictional-only public discovery rules. This module has no network, database,
 * model, logging, or personal-data dependencies.
 */
export const ACCESS_URL = "https://app.re-new.team/auth/login";

const listings = [
  {
    id: "demo-logistics-01",
    title: "Regional logistics operator",
    sector: "logistics",
    geography: "France",
    revenueBand: "EUR 3–5m",
    description: "Fictional established operator serving regional business customers.",
    active: true,
    publicationApproved: true,
  },
  {
    id: "demo-logistics-02",
    title: "Specialist transport services",
    sector: "logistics",
    geography: "France",
    revenueBand: null,
    description: "Fictional specialist service business; revenue is intentionally unspecified.",
    active: true,
    publicationApproved: true,
  },
  {
    id: "demo-services-01",
    title: "Business services provider",
    sector: "services",
    geography: "France",
    revenueBand: "EUR 5–10m",
    description: "Fictional recurring-revenue services business.",
    active: true,
    publicationApproved: true,
  },
  {
    id: "demo-withdrawn-01",
    title: "Withdrawn logistics sample",
    sector: "logistics",
    geography: "France",
    revenueBand: "EUR 3–5m",
    description: "Fictional fixture used to prove withdrawal handling.",
    active: false,
    publicationApproved: true,
  },
  {
    id: "demo-unapproved-01",
    title: "Unavailable service sample",
    sector: "services",
    geography: "France",
    revenueBand: "EUR 3–5m",
    description: "Fictional fixture used to prove publication handling.",
    active: true,
    publicationApproved: false,
  },
];

export const disclaimer = "Fictional demonstration data only. No real Re-New opportunity, business identity, source, contact detail, or protected information is included.";

function isEligible(listing) {
  return listing.active === true && listing.publicationApproved === true;
}

function safeCard(listing) {
  return {
    demoId: listing.id,
    title: listing.title,
    sector: listing.sector,
    broadGeography: listing.geography,
    annualRevenueBand: listing.revenueBand ?? "Not specified",
    description: listing.description,
    fictional: true,
  };
}

export function searchPublicOpportunities({ sector, geography = "France", annualRevenueBand } = {}) {
  const normalSector = sector?.toLowerCase();
  const normalGeography = geography?.toLowerCase();
  return {
    fictional: true,
    disclaimer,
    opportunities: listings
      .filter(isEligible)
      .filter((listing) => !normalSector || listing.sector === normalSector)
      .filter((listing) => !normalGeography || listing.geography.toLowerCase() === normalGeography)
      // A missing value is never a match when the buyer explicitly filters on revenue.
      .filter((listing) => !annualRevenueBand || listing.revenueBand === annualRevenueBand)
      .slice(0, 3)
      .map(safeCard),
  };
}

export function getPublicOpportunityTeaser({ demoId } = {}) {
  const listing = listings.find((candidate) => candidate.id === demoId);
  if (!listing || !isEligible(listing)) {
    return { fictional: true, disclaimer, found: false, message: "No public anonymous teaser is available for that demonstration ID." };
  }
  return { fictional: true, disclaimer, found: true, opportunity: safeCard(listing) };
}

export function buyerAccessHandoff() {
  return {
    fictional: true,
    accessUrl: ACCESS_URL,
    instructions: "Open the link, click Request it to open Request access, then choose Repreneur (buyer). This is a generic access path: no teaser identity or context is passed, no form is submitted, and access neither reserves a business nor grants protected opportunity access.",
  };
}
