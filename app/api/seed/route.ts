import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const TEST_REPRENEURS = [
  {
    email: "test.alice@example.com",
    first_name: "Test Alice",
    last_name: "Wonderland",
    phone: "+33 6 12 34 56 01",
    company_background: "15 years experience in retail management. Previously managed a chain of 12 stores.",
    investment_capacity: "€200,000 - €500,000",
    sector_preferences: ["Retail", "E-commerce"],
    target_location: "Paris, Île-de-France",
    target_acquisition_size: "€500K - €1M revenue",
    lifecycle_status: "lead",
    journey_stage: "explorer",
    source: "LinkedIn",
  },
  {
    email: "test.bob@example.com",
    first_name: "Test Bob",
    last_name: "Builder",
    phone: "+33 6 12 34 56 02",
    company_background: "Former construction company director. Looking to acquire a business in the same sector.",
    investment_capacity: "€500,000 - €1,000,000",
    sector_preferences: ["Construction", "Real Estate"],
    target_location: "Lyon, Auvergne-Rhône-Alpes",
    target_acquisition_size: "€1M - €2M revenue",
    lifecycle_status: "qualified",
    journey_stage: "ready",
    source: "Referral",
  },
  {
    email: "test.charlie@example.com",
    first_name: "Test Charlie",
    last_name: "Chaplin",
    phone: "+33 6 12 34 56 03",
    company_background: "Tech entrepreneur with 2 successful exits. Looking for traditional business acquisition.",
    investment_capacity: "€1,000,000+",
    sector_preferences: ["Manufacturing", "Food & Beverage"],
    target_location: "Bordeaux, Nouvelle-Aquitaine",
    target_acquisition_size: "€2M - €5M revenue",
    lifecycle_status: "client",
    journey_stage: "serial_acquirer",
    source: "Website",
  },
  {
    email: "test.diana@example.com",
    first_name: "Test Diana",
    last_name: "Prince",
    phone: "+33 6 12 34 56 04",
    company_background: "MBA graduate, worked in consulting for 8 years. First-time acquirer.",
    investment_capacity: "€100,000 - €200,000",
    sector_preferences: ["Services", "Consulting"],
    target_location: "Marseille, Provence-Alpes-Côte d'Azur",
    target_acquisition_size: "€200K - €500K revenue",
    lifecycle_status: "lead",
    journey_stage: "explorer",
    source: "BPI France",
  },
  {
    email: "test.ethan@example.com",
    first_name: "Test Ethan",
    last_name: "Hunt",
    phone: "+33 6 12 34 56 05",
    company_background: "Former sales director at a Fortune 500. Strong operational experience.",
    investment_capacity: "€300,000 - €600,000",
    sector_preferences: ["Technology", "SaaS"],
    target_location: "Toulouse, Occitanie",
    target_acquisition_size: "€500K - €1M revenue",
    lifecycle_status: "qualified",
    journey_stage: "learner",
    source: "LinkedIn",
  },
  {
    email: "test.fiona@example.com",
    first_name: "Test Fiona",
    last_name: "Green",
    phone: "+33 6 12 34 56 06",
    company_background: "Family business background. Third generation entrepreneur.",
    investment_capacity: "€500,000 - €800,000",
    sector_preferences: ["Agriculture", "Food & Beverage"],
    target_location: "Nantes, Pays de la Loire",
    target_acquisition_size: "€1M - €2M revenue",
    lifecycle_status: "lead",
    journey_stage: "learner",
    source: "Trade Show",
  },
  {
    email: "test.george@example.com",
    first_name: "Test George",
    last_name: "Curious",
    phone: "+33 6 12 34 56 07",
    company_background: "Banker turned entrepreneur. Strong financial analysis skills.",
    investment_capacity: "€400,000 - €700,000",
    sector_preferences: ["Finance", "Insurance"],
    target_location: "Strasbourg, Grand Est",
    target_acquisition_size: "€800K - €1.5M revenue",
    lifecycle_status: "qualified",
    journey_stage: "ready",
    source: "Referral",
  },
  {
    email: "test.hannah@example.com",
    first_name: "Test Hannah",
    last_name: "Montana",
    phone: "+33 6 12 34 56 08",
    company_background: "Marketing executive with international experience. Looking for lifestyle business.",
    investment_capacity: "€150,000 - €300,000",
    sector_preferences: ["Hospitality", "Tourism"],
    target_location: "Nice, Provence-Alpes-Côte d'Azur",
    target_acquisition_size: "€300K - €600K revenue",
    lifecycle_status: "client",
    journey_stage: "ready",
    source: "Website",
  },
  {
    email: "test.ivan@example.com",
    first_name: "Test Ivan",
    last_name: "Drago",
    phone: "+33 6 12 34 56 09",
    company_background: "Industrial engineer with 20 years experience. Seeking manufacturing business.",
    investment_capacity: "€600,000 - €1,200,000",
    sector_preferences: ["Manufacturing", "Industrial"],
    target_location: "Lille, Hauts-de-France",
    target_acquisition_size: "€1.5M - €3M revenue",
    lifecycle_status: "lead",
    journey_stage: "learner",
    source: "CCI",
  },
  {
    email: "test.julia@example.com",
    first_name: "Test Julia",
    last_name: "Roberts",
    phone: "+33 6 12 34 56 10",
    company_background: "Healthcare professional looking to transition to business ownership.",
    investment_capacity: "€200,000 - €400,000",
    sector_preferences: ["Healthcare", "Wellness"],
    target_location: "Montpellier, Occitanie",
    target_acquisition_size: "€400K - €800K revenue",
    lifecycle_status: "qualified",
    journey_stage: "explorer",
    source: "LinkedIn",
  },
]

const TEST_OFFERS = [
  {
    name: "Discovery Pack",
    description: "Initial consultation and market analysis for first-time acquirers.",
    price: 1500,
    duration_days: 30,
    acceptance_deadline_days: 7,
    includes_hours: 10,
    includes_resources: false,
    is_active: true,
  },
  {
    name: "Starter Pack",
    description: "Complete support for your first acquisition including due diligence guidance.",
    price: 2500,
    duration_days: 90,
    acceptance_deadline_days: 14,
    includes_hours: 25,
    includes_resources: true,
    is_active: true,
  },
  {
    name: "Professional Pack",
    description: "Full-service acquisition support with dedicated advisor and legal review.",
    price: 5000,
    duration_days: 180,
    acceptance_deadline_days: 14,
    includes_hours: 50,
    includes_resources: true,
    is_active: true,
  },
  {
    name: "Enterprise Pack",
    description: "Premium package for complex acquisitions with ongoing support.",
    price: 10000,
    duration_days: 365,
    acceptance_deadline_days: 21,
    includes_hours: 100,
    includes_resources: true,
    is_active: true,
  },
]

const TEST_NOTES = [
  "Initial call - very interested in retail sector. Has experience managing multiple locations.",
  "Sent information pack about our services. Will follow up next week.",
  "Meeting scheduled for next Tuesday to discuss acquisition criteria.",
  "Reviewed financial capacity - well-positioned for mid-market acquisition.",
  "Introduced to potential target company. Waiting for feedback.",
  "Due diligence started. Client is thorough and asks good questions.",
  "Negotiation phase - helping with price discussions.",
  "Deal closed successfully! Client very satisfied with our support.",
  "Follow-up call - checking in on business transition progress.",
  "Referral received from this client - they recommended us to a colleague.",
]

export async function POST() {
  const supabase = await createServerClient()

  // Get current user for created_by field
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    // Insert repreneurs
    const { data: repreneurs, error: repreneurError } = await supabase
      .from("repreneurs")
      .insert(TEST_REPRENEURS.map((r) => ({ ...r, created_by: user.id })))
      .select()

    if (repreneurError) {
      return NextResponse.json({ error: `Repreneur error: ${repreneurError.message}` }, { status: 500 })
    }

    // Insert offers (skip if Starter Pack already exists from previous test)
    const { data: existingOffers } = await supabase.from("offers").select("name")
    const existingNames = existingOffers?.map((o) => o.name) || []
    const newOffers = TEST_OFFERS.filter((o) => !existingNames.includes(o.name))

    let offers = existingOffers || []
    if (newOffers.length > 0) {
      const { data: insertedOffers, error: offerError } = await supabase.from("offers").insert(newOffers).select()

      if (offerError) {
        return NextResponse.json({ error: `Offer error: ${offerError.message}` }, { status: 500 })
      }
      offers = [...(existingOffers || []), ...(insertedOffers || [])]
    }

    // Get all offers for assignment
    const { data: allOffers } = await supabase.from("offers").select("*")

    // Add notes to some repreneurs (2-3 notes each for first 5 repreneurs)
    const notesToInsert = []
    for (let i = 0; i < 5; i++) {
      const repreneur = repreneurs?.[i]
      if (repreneur) {
        const numNotes = Math.floor(Math.random() * 2) + 2 // 2-3 notes
        for (let j = 0; j < numNotes; j++) {
          const noteIndex = (i * 2 + j) % TEST_NOTES.length
          notesToInsert.push({
            repreneur_id: repreneur.id,
            content: TEST_NOTES[noteIndex],
            created_by: user.id,
          })
        }
      }
    }

    if (notesToInsert.length > 0) {
      const { error: noteError } = await supabase.from("notes").insert(notesToInsert)
      if (noteError) {
        console.error("Note error:", noteError)
      }
    }

    // Assign offers to some repreneurs (clients and some qualified)
    const offersToAssign = []
    const clientRepreneurs = repreneurs?.filter((r) => r.lifecycle_status === "client") || []
    const qualifiedRepreneurs = repreneurs?.filter((r) => r.lifecycle_status === "qualified") || []

    // Clients get active offers
    for (const client of clientRepreneurs) {
      const offer = allOffers?.[Math.floor(Math.random() * (allOffers?.length || 1))]
      if (offer) {
        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + offer.duration_days)

        offersToAssign.push({
          repreneur_id: client.id,
          offer_id: offer.id,
          status: "active",
          offered_at: now.toISOString(),
          accepted_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
        })
      }
    }

    // Some qualified get offered status
    for (let i = 0; i < Math.min(2, qualifiedRepreneurs.length); i++) {
      const qualified = qualifiedRepreneurs[i]
      const offer = allOffers?.[i % (allOffers?.length || 1)]
      if (offer) {
        offersToAssign.push({
          repreneur_id: qualified.id,
          offer_id: offer.id,
          status: "offered",
          offered_at: new Date().toISOString(),
          created_by: user.id,
        })
      }
    }

    if (offersToAssign.length > 0) {
      const { error: assignError } = await supabase.from("repreneur_offers").insert(offersToAssign)
      if (assignError) {
        console.error("Assign error:", assignError)
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        repreneurs: repreneurs?.length || 0,
        offers: newOffers.length,
        notes: notesToInsert.length,
        offerAssignments: offersToAssign.length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
