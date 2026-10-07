import type { Client } from "pg"
import { OPENING_READINESS_FIXTURE as fixture } from "../../lib/opening-readiness-fixture"

// Initial synthetic setup must satisfy the same deferred source/contact
// constraints as a persisted product dossier. No trigger is bypassed.
export async function seedActiveOpeningOpportunity(db: Client, input: {
  opportunityId: string
  reference: string
  title: string
  description: string
}) {
  await db.query("BEGIN")
  try {
    await db.query("SET CONSTRAINTS ALL DEFERRED")
    await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
      VALUES($1,$2,'active',false,$3,$4,$5,$6)`, [input.opportunityId, input.reference, fixture.ids.realOffice, input.title, input.description, fixture.staff.id])
    await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
      SELECT $1,affiliation.id,contact.display_name,true,$3
      FROM public.ma_contact_office_affiliations affiliation
      JOIN public.ma_contacts contact ON contact.id=affiliation.contact_id
      WHERE affiliation.id=$2`, [input.opportunityId, fixture.ids.realAffiliation, fixture.staff.id])
    await db.query("SET CONSTRAINTS ALL IMMEDIATE")
    await db.query("COMMIT")
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  }
}
