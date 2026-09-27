import type { Language } from "./translations"

const sectorEnglish: Record<string, string> = {
  "Agroalimentaire": "Food & agriculture",
  "Industrie manufacturière": "Manufacturing",
  "Industrie lourde": "Heavy industry",
  "Industrie pharmaceutique & Dispositifs médicaux": "Pharmaceuticals & medical devices",
  "Services de santé": "Healthcare services",
  "Automobile & Mobilité": "Automotive & mobility",
  "Textile, Luxe & Mode": "Textiles, luxury & fashion",
  "Commerce, Négoce & Distribution": "Retail, trading & distribution",
  "BTP & Construction": "Construction",
  "Services aux entreprises (B2B)": "Business services (B2B)",
  "Services aux particuliers (B2C)": "Consumer services (B2C)",
  "Tech & Digital": "Tech & digital",
  "Environnement & Énergie": "Environment & energy",
  "Hôtellerie, Restauration & Loisirs": "Hospitality, restaurants & leisure",
  "Transport & Logistique": "Transport & logistics",
  "Autre": "Other",
}

const geography: Record<string, { fr: string; en: string }> = {
  "all-france": { fr: "Toute la France", en: "All France" },
  "auvergne-rhone-alpes": { fr: "Auvergne-Rhône-Alpes", en: "Auvergne-Rhône-Alpes" },
  "bourgogne-franche-comte": { fr: "Bourgogne-Franche-Comté", en: "Bourgogne-Franche-Comté" },
  bretagne: { fr: "Bretagne", en: "Brittany" },
  "centre-val-de-loire": { fr: "Centre-Val de Loire", en: "Centre-Val de Loire" },
  corse: { fr: "Corse", en: "Corsica" },
  "dom-tom": { fr: "Outre-mer", en: "French overseas territories" },
  "grand-est": { fr: "Grand Est", en: "Grand Est" },
  "hauts-de-france": { fr: "Hauts-de-France", en: "Hauts-de-France" },
  "ile-de-france": { fr: "Île-de-France", en: "Île-de-France" },
  normandie: { fr: "Normandie", en: "Normandy" },
  "nouvelle-aquitaine": { fr: "Nouvelle-Aquitaine", en: "Nouvelle-Aquitaine" },
  occitanie: { fr: "Occitanie", en: "Occitanie" },
  "pays-de-la-loire": { fr: "Pays de la Loire", en: "Pays de la Loire" },
  paca: { fr: "Provence-Alpes-Côte d’Azur", en: "Provence-Alpes-Côte d’Azur" },
}

const milestoneFrench: Record<string, string> = {
  decision_to_pursue: "La reprise est mon projet principal",
  availability_confirmed: "Disponibilité confirmée",
  target_profile_sheet: "Profil de cible défini",
  pitch_plan: "Présentation et plan de création de valeur",
  equity_range: "Apport personnel confirmé",
  deal_breakers: "Points bloquants identifiés",
  leadership_assessment_passed: "Évaluation de leadership validée",
  advisory_team_identified: "Équipe de conseil identifiée",
  intermediary_meeting: "Échange avec un intermédiaire",
  seller_meeting: "Échange avec un cédant",
  loi_issued: "Lettre d’intention transmise",
  due_diligence: "Due diligence engagée",
  negotiation: "Négociation",
  financing_validated: "Financement validé",
  closing: "Acquisition finalisée",
  plan_100_days: "Plan à 100 jours remis",
  plan_3_years: "Plan de création de valeur à trois ans",
}

export function sectorUiLabel(value: string, language: Language) {
  if (language === "fr") return value
  return sectorEnglish[value] ?? value
}

export function geographyUiLabel(value: string, language: Language) {
  return geography[value]?.[language]
    ?? Object.values(geography).find((entry) => entry.fr === value || entry.en === value)?.[language]
    ?? value
}

export function milestoneUiLabel(key: string, originalEnglish: string, language: Language) {
  return language === "fr" ? milestoneFrench[key] ?? originalEnglish : originalEnglish
}

export function thesisOptionUiLabel(value: string, originalFrench: string, language: Language) {
  if (language === "fr") return originalFrench
  if (sectorEnglish[value]) return sectorEnglish[value]
  if (geography[value]) return geography[value].en
  const labels: Record<string, string> = {
    "1-3M": "€1–3M", "3-5M": "€3–5M", ">5M": "Over €5M",
    tbd: "Under €150K", "151-250": "€151–250K", "251-350": "€251–350K",
    "351-450": "€351–450K", ">450": "Over €450K",
  }
  return labels[value] ?? originalFrench
}
