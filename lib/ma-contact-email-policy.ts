export type MaContactEmailPurpose =
  | "campaign"
  | "general_relationship"
  | "opportunity_general"
  | "opportunity_nda_request"

const NDA_REQUEST_TEMPLATE = "ma_nda_info_memo_request"

export function maContactEmailPurposeForTemplate(
  templateKey: string,
): MaContactEmailPurpose {
  return templateKey === NDA_REQUEST_TEMPLATE
    ? "opportunity_nda_request"
    : "opportunity_general"
}

export function suppressionBlocksMaTemplate(
  campaignEmailSuppressed: boolean,
  templateKey: string,
) {
  return (
    campaignEmailSuppressed &&
    maContactEmailPurposeForTemplate(templateKey) !==
      "opportunity_nda_request"
  )
}
