import type { Language } from "./translations"

const intakeOutcomes: Record<string, { fr: string; en: string }> = {
  "Le CV téléversé n’est plus valide. Veuillez le sélectionner à nouveau.": {
    fr: "Le CV téléversé n’est plus valide. Sélectionnez-le à nouveau.", en: "Your uploaded CV is no longer valid. Select it again.",
  },
  "La lettre de cadrage téléversée n’est plus valide. Veuillez la sélectionner à nouveau.": {
    fr: "La lettre de cadrage téléversée n’est plus valide. Sélectionnez-la à nouveau.", en: "Your uploaded Lettre de cadrage is no longer valid. Select it again.",
  },
  "Le document téléversé n’est plus valide. Veuillez le sélectionner à nouveau.": {
    fr: "Le document téléversé n’est plus valide. Sélectionnez-le à nouveau.", en: "An uploaded document is no longer valid. Select it again.",
  },
  "Sélectionnez au moins un secteur cible.": { fr: "Sélectionnez au moins un secteur cible.", en: "Select at least one target sector." },
  "Cette adresse email est déjà enregistrée.": { fr: "Cette adresse e-mail est déjà enregistrée.", en: "This email address is already registered." },
  "Le chiffre d’affaires cible minimum doit être un nombre positif.": { fr: "Le chiffre d’affaires cible minimum doit être un nombre positif.", en: "Enter a valid minimum target revenue." },
  "Le chiffre d’affaires cible maximum doit être un nombre positif.": { fr: "Le chiffre d’affaires cible maximum doit être un nombre positif.", en: "Enter a valid maximum target revenue." },
  "L’EBITDA cible minimum doit être un nombre positif.": { fr: "L’EBITDA cible minimum doit être un nombre positif.", en: "Enter a valid minimum target EBITDA." },
  "L’EBITDA cible maximum doit être un nombre positif.": { fr: "L’EBITDA cible maximum doit être un nombre positif.", en: "Enter a valid maximum target EBITDA." },
  "La marge EBITDA minimale doit être comprise entre 0 et 100 %.": { fr: "La marge EBITDA minimale doit être comprise entre 0 et 100 %.", en: "The minimum EBITDA margin must be between 0 and 100%." },
  "L’effectif cible minimum doit être un nombre entier positif.": { fr: "L’effectif cible minimum doit être un nombre entier positif.", en: "Enter a valid minimum whole-number team size." },
  "L’effectif cible maximum doit être un nombre entier positif.": { fr: "L’effectif cible maximum doit être un nombre entier positif.", en: "Enter a valid maximum whole-number team size." },
  "Revenue range minimum cannot be greater than its maximum.": { fr: "La borne minimale de chiffre d’affaires ne peut pas dépasser la borne maximale.", en: "The minimum revenue cannot exceed the maximum." },
  "EBITDA range minimum cannot be greater than its maximum.": { fr: "La borne minimale d’EBITDA ne peut pas dépasser la borne maximale.", en: "The minimum EBITDA cannot exceed the maximum." },
  "Staff-size range minimum cannot be greater than its maximum.": { fr: "La borne minimale d’effectif ne peut pas dépasser la borne maximale.", en: "The minimum team size cannot exceed the maximum." },
  "La borne minimale de chiffre d’affaires ne peut pas dépasser la borne maximale.": { fr: "La borne minimale de chiffre d’affaires ne peut pas dépasser la borne maximale.", en: "The minimum revenue cannot exceed the maximum." },
  "La borne minimale d’EBITDA ne peut pas dépasser la borne maximale.": { fr: "La borne minimale d’EBITDA ne peut pas dépasser la borne maximale.", en: "The minimum EBITDA cannot exceed the maximum." },
  "La borne minimale d’effectif ne peut pas dépasser la borne maximale.": { fr: "La borne minimale d’effectif ne peut pas dépasser la borne maximale.", en: "The minimum team size cannot exceed the maximum." },
}

const thesisValidationOutcomes: Record<string, { fr: string; en: string }> = {
  "Geography needs at least one selection.": { fr: "Sélectionnez au moins une zone géographique.", en: "Select at least one geographic area." },
  "Sectors needs at least one selection.": { fr: "Sélectionnez au moins un secteur.", en: "Select at least one sector." },
  "Deal size needs at least one selection.": { fr: "Sélectionnez au moins une taille de transaction.", en: "Select at least one deal size." },
  "Investment capacity needs at least one selection.": { fr: "Sélectionnez votre capacité d’investissement.", en: "Select your investment capacity." },
  "Revenue minimum must be a number between 0 and 100000.": { fr: "Le chiffre d’affaires cible minimum doit être un nombre positif.", en: "Enter a valid minimum target revenue." },
  "Revenue maximum must be a number between 0 and 100000.": { fr: "Le chiffre d’affaires cible maximum doit être un nombre positif.", en: "Enter a valid maximum target revenue." },
  "EBITDA minimum must be a number between 0 and 100000.": { fr: "L’EBITDA cible minimum doit être un nombre positif.", en: "Enter a valid minimum target EBITDA." },
  "EBITDA maximum must be a number between 0 and 100000.": { fr: "L’EBITDA cible maximum doit être un nombre positif.", en: "Enter a valid maximum target EBITDA." },
  "Minimum EBITDA margin must be a number between 0 and 100.": { fr: "La marge EBITDA minimale doit être comprise entre 0 et 100 %.", en: "The minimum EBITDA margin must be between 0 and 100%." },
  "Staff-size minimum must be a number between 0 and 100000.": { fr: "L’effectif cible minimum doit être un nombre entier positif.", en: "Enter a valid minimum whole-number team size." },
  "Staff-size maximum must be a number between 0 and 100000.": { fr: "L’effectif cible maximum doit être un nombre entier positif.", en: "Enter a valid maximum whole-number team size." },
  "Revenue range minimum cannot be greater than its maximum.": { fr: "La borne minimale de chiffre d’affaires ne peut pas dépasser la borne maximale.", en: "The minimum revenue cannot exceed the maximum." },
  "EBITDA range minimum cannot be greater than its maximum.": { fr: "La borne minimale d’EBITDA ne peut pas dépasser la borne maximale.", en: "The minimum EBITDA cannot exceed the maximum." },
  "Staff-size range minimum cannot be greater than its maximum.": { fr: "La borne minimale d’effectif ne peut pas dépasser la borne maximale.", en: "The minimum team size cannot exceed the maximum." },
}

const assessmentOutcomes: Record<string, { fr: string; en: string }> = {
  "Assessment not found": { fr: "Évaluation introuvable ou lien expiré.", en: "Assessment not found or link expired." },
  "This assessment has already been completed": { fr: "Cette évaluation a déjà été complétée.", en: "This assessment has already been completed." },
  "Failed to save assessment": { fr: "Impossible d’enregistrer l’évaluation. Réessayez.", en: "Could not save the assessment. Please try again." },
}

export function publicIntakeError(error: unknown, language: Language) {
  if (typeof error === "string" && intakeOutcomes[error]) return intakeOutcomes[error][language]
  return language === "fr" ? "Impossible de terminer la candidature. Vérifiez vos réponses et réessayez." : "Could not finish the application. Check your answers and try again."
}

export function publicAssessmentError(error: unknown, language: Language) {
  if (typeof error === "string" && assessmentOutcomes[error]) return assessmentOutcomes[error][language]
  return language === "fr" ? "Impossible de terminer l’évaluation. Réessayez." : "Could not finish the assessment. Please try again."
}

export function publicThesisValidationError(error: unknown, language: Language) {
  if (typeof error === "string" && thesisValidationOutcomes[error]) return thesisValidationOutcomes[error][language]
  return language === "fr" ? "Vérifiez les critères de reprise et réessayez." : "Check the acquisition criteria and try again."
}
