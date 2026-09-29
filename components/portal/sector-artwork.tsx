"use client"

import Image from "next/image"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeOpportunitySector, type Sector } from "@/lib/utils/opportunity-sector"
import { sectorUiLabel } from "@/lib/i18n/canonical-labels"
import { useUiLanguage } from "@/components/i18n/ui-text"
import styles from "./sector-artwork.module.css"

/** Generic approved Option 01 artwork, mapped only to the 16-sector taxonomy. */
const artwork: Record<Sector, string | null> = {
  "Agroalimentaire": "food",
  "Industrie manufacturière": "manufacturing",
  "Industrie lourde": "equipment",
  "Industrie pharmaceutique & Dispositifs médicaux": "medical",
  "Services de santé": "medical",
  "Automobile & Mobilité": "equipment",
  "Textile, Luxe & Mode": "packaging",
  "Commerce, Négoce & Distribution": "distribution",
  "BTP & Construction": "equipment",
  "Services aux entreprises (B2B)": "services",
  "Services aux particuliers (B2C)": "services",
  "Tech & Digital": "software",
  "Environnement & Énergie": "environment",
  "Hôtellerie, Restauration & Loisirs": "food",
  "Transport & Logistique": "logistics",
  "Autre": null,
}

export function SectorArtwork({ sector, large = false, action = false }: {
  sector: string | null | undefined
  large?: boolean
  action?: boolean
}) {
  const language = useUiLanguage()
  const canonical = normalizeOpportunitySector(sector)
  const key = canonical && Object.hasOwn(artwork, canonical) ? artwork[canonical as Sector] : null
  const label = canonical ? sectorUiLabel(canonical, language) : sector || (language === "fr" ? "Secteur à préciser" : "Sector to confirm")
  const alt = language === "fr" ? `Illustration du secteur : ${label}. Pas une photo de l’entreprise.` : `Sector illustration: ${label}. Not a company photograph.`
  return <span className={cn(styles.avatar, large ? styles.large : styles.small, action && styles.action)} data-action-avatar={action || undefined} title={alt}>
    {key ? <Image src={`/sector-artwork/${key}.webp`} alt={alt} width={large ? 80 : 48} height={large ? 80 : 48} className="size-full rounded-[6px] object-cover" />
      : <span className="grid size-full place-items-center rounded-[6px] bg-muted text-muted-foreground" role="img" aria-label={alt}><Building2 className={large ? "size-8" : "size-5"} aria-hidden="true" /></span>}
  </span>
}
