-- Migration: Demo M&A source contact enrichment
-- Purpose: Replace generic demo source labels with clearly marked demo
-- intermediary contacts so the M&A directory is useful during product demos.

WITH source_mapping (
  old_firm_name,
  firm_name,
  source_type,
  contact_name,
  contact_email,
  contact_phone,
  notes
) AS (
  VALUES
    (
      'Demo pattern: agri-food PME reprise profile',
      'Agri Transmission Conseil-DEMO',
      'ma_firm',
      'Claire Martin',
      'claire.martin@demo.renew.local',
      '+33 1 48 10 21 01',
      'Demo intermediary for regional food production opportunities.'
    ),
    (
      'Demo pattern: distribution SME with repeat orders',
      'Distribution Deals Ouest-DEMO',
      'broker',
      'Julien Moreau',
      'julien.moreau@demo.renew.local',
      '+33 1 48 10 21 02',
      'Demo broker for recurring-revenue distribution SMEs.'
    ),
    (
      'Demo pattern: environment/recycling SME opportunity',
      'Green Transition M&A-DEMO',
      'ma_firm',
      'Sophie Renard',
      'sophie.renard@demo.renew.local',
      '+33 1 48 10 21 03',
      'Demo source for waste, recycling, and circular-economy SMEs.'
    ),
    (
      'Demo pattern: facility services acquisition profile',
      'Facility Partners Conseil-DEMO',
      'broker',
      'Nicolas Petit',
      'nicolas.petit@demo.renew.local',
      '+33 1 48 10 21 04',
      'Demo broker for B2B facility and cleaning services.'
    ),
    (
      'Demo pattern: French industrial transmission listing',
      'Industrie Transmission Est-DEMO',
      'ma_firm',
      'Anne Lefevre',
      'anne.lefevre@demo.renew.local',
      '+33 1 48 10 21 05',
      'Demo M&A advisor for industrial and manufacturing transmissions.'
    ),
    (
      'Demo pattern: Fusacq-style repreneur search for industrial laundry',
      'Fusacq Laundry Relay-DEMO',
      'broker',
      'Marc Aubry',
      'marc.aubry@demo.renew.local',
      '+33 1 48 10 21 06',
      'Demo source for owner-led laundry and textile-services opportunities.'
    ),
    (
      'Demo pattern: Fusacq/CRA-style B2B services SME',
      'CRA Services Network-DEMO',
      'broker',
      'Pauline Girard',
      'pauline.girard@demo.renew.local',
      '+33 1 48 10 21 07',
      'Demo broker network for B2B services SMEs.'
    ),
    (
      'Demo pattern: healthcare distribution SME',
      'Sante Distribution Conseil-DEMO',
      'ma_firm',
      'Thomas Bernard',
      'thomas.bernard@demo.renew.local',
      '+33 1 48 10 21 08',
      'Demo source for healthcare distribution and equipment opportunities.'
    ),
    (
      'Demo pattern: hospitality business transfer listing',
      'Hotellerie Transmission-DEMO',
      'broker',
      'Emma Laurent',
      'emma.laurent@demo.renew.local',
      '+33 1 48 10 21 09',
      'Demo broker for hospitality and restaurant transfers.'
    ),
    (
      'Demo pattern: maintenance/installation SME listing',
      'Batiment Services M&A-DEMO',
      'ma_firm',
      'Hugo Simon',
      'hugo.simon@demo.renew.local',
      '+33 1 48 10 21 10',
      'Demo source for building maintenance and technical services.'
    ),
    (
      'Demo pattern: manufacturing PME in bonis',
      'PME Industrielles France-DEMO',
      'ma_firm',
      'Camille Durand',
      'camille.durand@demo.renew.local',
      '+33 1 48 10 21 11',
      'Demo intermediary for profitable small manufacturing businesses.'
    ),
    (
      'Demo pattern: public SME sale listing, electrical works',
      'Electricite Transmission Nord-DEMO',
      'broker',
      'Olivier Caron',
      'olivier.caron@demo.renew.local',
      '+33 1 48 10 21 12',
      'Demo source for electrical works and installation contractors.'
    ),
    (
      'Demo pattern: small digital services acquisition target',
      'Digital PME Deals-DEMO',
      'direct',
      'Laura Fontaine',
      'laura.fontaine@demo.renew.local',
      '+33 1 48 10 21 13',
      'Demo direct source for small digital services acquisition targets.'
    ),
    (
      'Demo pattern: small transport/logistics SME',
      'Logistique Transmission-DEMO',
      'broker',
      'Antoine Roche',
      'antoine.roche@demo.renew.local',
      '+33 1 48 10 21 14',
      'Demo broker for small transport and logistics SMEs.'
    ),
    (
      'Demo pattern: trade retail SME transfer',
      'Commerce Transmission Sud-DEMO',
      'broker',
      'Manon Vidal',
      'manon.vidal@demo.renew.local',
      '+33 1 48 10 21 15',
      'Demo source for retail and local trade business transfers.'
    )
),
updated_sources AS (
  UPDATE public.ma_sources s
  SET firm_name = m.firm_name,
      source_type = m.source_type::ma_source_type,
      contact_name = m.contact_name,
      contact_email = m.contact_email,
      contact_phone = m.contact_phone,
      notes = m.notes,
      updated_at = NOW()
  FROM source_mapping m
  WHERE s.firm_name = m.old_firm_name
  RETURNING s.id, m.firm_name
)
UPDATE public.opportunities o
SET source_label = updated_sources.firm_name,
    updated_at = NOW()
FROM updated_sources
WHERE o.source_id = updated_sources.id;
