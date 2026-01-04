import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { calculateTier1Score } from "@/lib/utils/tier1-scoring"

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
    // Questionnaire fields
    q1_employment_status: "transition",
    q2_years_experience: "16_20",
    q3_industry_sectors: ["commerce_detail", "commerce_gros"],
    q4_has_ma_experience: false,
    q5_team_size: "20_50",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["division_director"],
    q9_board_experience: false,
    q10_journey_stages: ["info_only", "first_contacts"],
    q11_target_sectors: ["commerce_detail"],
    q12_has_identified_targets: false,
    q13_target_details: null,
    q14_investment_capacity: "251_350",
    q15_funding_status: "in_progress",
    q16_network_training: ["cci"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "sans_emploi",
    q2_years_experience: "20_plus",
    q3_industry_sectors: ["construction", "immobilier", "gestion_entreprises"],
    q4_has_ma_experience: true,
    q5_team_size: "50_plus",
    q6_involved_in_ma: true,
    q7_ma_details: "Led acquisition of 2 smaller construction firms in 2019",
    q8_executive_roles: ["ceo", "coo"],
    q9_board_experience: true,
    q10_journey_stages: ["training_done", "target_search", "financing_defined"],
    q11_target_sectors: ["construction", "immobilier"],
    q12_has_identified_targets: true,
    q13_target_details: "3 potential targets in Lyon area, revenue €800K-€1.5M",
    q14_investment_capacity: "450_plus",
    q15_funding_status: "secured",
    q16_network_training: ["cra", "cci"],
    q17_open_to_co_acquisition: false,
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
    tier2_stars: 5,
    // Questionnaire fields
    q1_employment_status: "independant",
    q2_years_experience: "20_plus",
    q3_industry_sectors: ["information_medias", "services_pro", "scientifiques_techniques"],
    q4_has_ma_experience: true,
    q5_team_size: "50_plus",
    q6_involved_in_ma: true,
    q7_ma_details: "2 tech company exits, 1 acquisition as buyer",
    q8_executive_roles: ["ceo", "cfo"],
    q9_board_experience: true,
    q10_journey_stages: ["financing_defined", "letter_of_intent"],
    q11_target_sectors: ["industrie", "hebergement_restauration"],
    q12_has_identified_targets: true,
    q13_target_details: "Winery in Bordeaux region, €2.5M revenue",
    q14_investment_capacity: "450_plus",
    q15_funding_status: "secured",
    q16_network_training: ["cra"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "temps_plein",
    q2_years_experience: "less_10",
    q3_industry_sectors: ["services_pro", "gestion_entreprises"],
    q4_has_ma_experience: false,
    q5_team_size: "less_10",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["other"],
    q9_board_experience: false,
    q10_journey_stages: ["info_only"],
    q11_target_sectors: ["services_pro"],
    q12_has_identified_targets: false,
    q13_target_details: null,
    q14_investment_capacity: "151_250",
    q15_funding_status: "in_progress",
    q16_network_training: ["none"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "transition",
    q2_years_experience: "16_20",
    q3_industry_sectors: ["information_medias", "commerce_gros"],
    q4_has_ma_experience: false,
    q5_team_size: "20_50",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["cco"],
    q9_board_experience: false,
    q10_journey_stages: ["first_contacts", "training_done"],
    q11_target_sectors: ["information_medias", "services_pro"],
    q12_has_identified_targets: false,
    q13_target_details: null,
    q14_investment_capacity: "351_450",
    q15_funding_status: "in_progress",
    q16_network_training: ["cci", "other"],
    q17_open_to_co_acquisition: false,
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
    lifecycle_status: "client",
    journey_stage: "ready",
    source: "Trade Show",
    tier2_stars: 4,
    // Questionnaire fields
    q1_employment_status: "independant",
    q2_years_experience: "11_15",
    q3_industry_sectors: ["agriculture", "hebergement_restauration", "commerce_detail"],
    q4_has_ma_experience: true,
    q5_team_size: "11_20",
    q6_involved_in_ma: true,
    q7_ma_details: "Participated in family business merger in 2020",
    q8_executive_roles: ["ceo"],
    q9_board_experience: true,
    q10_journey_stages: ["training_done", "target_search"],
    q11_target_sectors: ["agriculture", "hebergement_restauration"],
    q12_has_identified_targets: true,
    q13_target_details: "Organic farm with processing facility near Nantes",
    q14_investment_capacity: "450_plus",
    q15_funding_status: "secured",
    q16_network_training: ["cra", "other"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "sans_emploi",
    q2_years_experience: "16_20",
    q3_industry_sectors: ["finance_assurances", "gestion_entreprises"],
    q4_has_ma_experience: true,
    q5_team_size: "11_20",
    q6_involved_in_ma: true,
    q7_ma_details: "Advised on 5+ M&A deals as investment banker",
    q8_executive_roles: ["cfo", "division_director"],
    q9_board_experience: false,
    q10_journey_stages: ["training_done", "financing_defined"],
    q11_target_sectors: ["finance_assurances", "services_pro"],
    q12_has_identified_targets: true,
    q13_target_details: "Insurance brokerage in Alsace region",
    q14_investment_capacity: "351_450",
    q15_funding_status: "secured",
    q16_network_training: ["cra", "cci"],
    q17_open_to_co_acquisition: false,
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
    tier2_stars: 3,
    // Questionnaire fields
    q1_employment_status: "temps_plein",
    q2_years_experience: "11_15",
    q3_industry_sectors: ["hebergement_restauration", "spectacles_loisirs"],
    q4_has_ma_experience: false,
    q5_team_size: "less_10",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["cco"],
    q9_board_experience: false,
    q10_journey_stages: ["first_contacts", "target_search"],
    q11_target_sectors: ["hebergement_restauration", "spectacles_loisirs"],
    q12_has_identified_targets: true,
    q13_target_details: "Boutique hotel in Nice old town",
    q14_investment_capacity: "151_250",
    q15_funding_status: "in_progress",
    q16_network_training: ["other"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "temps_plein",
    q2_years_experience: "20_plus",
    q3_industry_sectors: ["industrie", "transport", "construction"],
    q4_has_ma_experience: false,
    q5_team_size: "50_plus",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["coo", "cto"],
    q9_board_experience: false,
    q10_journey_stages: ["first_contacts", "training_done"],
    q11_target_sectors: ["industrie"],
    q12_has_identified_targets: false,
    q13_target_details: null,
    q14_investment_capacity: "450_plus",
    q15_funding_status: "in_progress",
    q16_network_training: ["cci"],
    q17_open_to_co_acquisition: true,
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
    // Questionnaire fields
    q1_employment_status: "temps_plein",
    q2_years_experience: "16_20",
    q3_industry_sectors: ["sante"],
    q4_has_ma_experience: false,
    q5_team_size: "less_10",
    q6_involved_in_ma: false,
    q7_ma_details: null,
    q8_executive_roles: ["other"],
    q9_board_experience: false,
    q10_journey_stages: ["info_only", "first_contacts"],
    q11_target_sectors: ["sante", "services_pro"],
    q12_has_identified_targets: false,
    q13_target_details: null,
    q14_investment_capacity: "251_350",
    q15_funding_status: "in_progress",
    q16_network_training: ["none"],
    q17_open_to_co_acquisition: true,
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

// Note templates - will be combined with context
const NOTE_TEMPLATES = [
  "Initial call completed. Candidate seems motivated and has clear acquisition criteria.",
  "Sent information pack about our services. Will follow up next week.",
  "Meeting scheduled for next Tuesday to discuss acquisition criteria in detail.",
  "Reviewed financial capacity documents. Well-positioned for mid-market acquisition.",
  "Introduced candidate to potential target company in their sector. Waiting for feedback.",
  "Due diligence support started. Candidate is thorough and asks good questions.",
  "Helped prepare initial offer letter. Strong negotiation skills observed.",
  "Follow-up call completed. Candidate is progressing well in their search.",
  "Referral received from this candidate. They recommended us to a colleague.",
  "Discussed financing options. Candidate has strong bank relationships.",
  "Provided market analysis for target sector. Candidate found it very helpful.",
  "Coaching session on negotiation tactics completed.",
  "Candidate attended our workshop on due diligence best practices.",
  "Reviewed their acquisition criteria. Helped refine target profile.",
  "Connected candidate with our legal partner for preliminary consultation.",
]

// Activity templates with types
const ACTIVITY_TEMPLATES: { type: "welcome_email" | "interview" | "offer_submitted" | "meeting"; notes: string; duration?: number }[] = [
  { type: "welcome_email", notes: "Sent welcome email with Re-New introduction and next steps" },
  { type: "interview", notes: "Initial screening interview completed. Good fit for our program.", duration: 45 },
  { type: "interview", notes: "In-depth interview about acquisition criteria and timeline.", duration: 60 },
  { type: "meeting", notes: "Strategy session to define target profile and search criteria.", duration: 90 },
  { type: "meeting", notes: "Follow-up meeting to review progress and adjust strategy.", duration: 45 },
  { type: "meeting", notes: "Coaching session on valuation methods and deal structuring.", duration: 60 },
  { type: "offer_submitted", notes: "Presented service package options. Candidate reviewing proposal." },
  { type: "interview", notes: "Final qualification interview before onboarding.", duration: 30 },
  { type: "meeting", notes: "Kick-off meeting for active engagement. Defined milestones.", duration: 75 },
  { type: "meeting", notes: "Monthly check-in call. Candidate making good progress.", duration: 30 },
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
    // Calculate tier1 scores for all repreneurs
    const repreneursWithScores = TEST_REPRENEURS.map((r) => {
      const scoreBreakdown = calculateTier1Score({
        q1_employment_status: r.q1_employment_status,
        q2_years_experience: r.q2_years_experience,
        q3_industry_sectors: r.q3_industry_sectors,
        q4_has_ma_experience: r.q4_has_ma_experience,
        q5_team_size: r.q5_team_size,
        q6_involved_in_ma: r.q6_involved_in_ma,
        q8_executive_roles: r.q8_executive_roles,
        q9_board_experience: r.q9_board_experience,
        q10_journey_stages: r.q10_journey_stages,
        q11_target_sectors: r.q11_target_sectors,
        q12_has_identified_targets: r.q12_has_identified_targets,
        q14_investment_capacity: r.q14_investment_capacity,
        q15_funding_status: r.q15_funding_status,
        q16_network_training: r.q16_network_training,
        q17_open_to_co_acquisition: r.q17_open_to_co_acquisition,
      })

      return {
        ...r,
        tier1_score: scoreBreakdown.total,
        tier1_score_breakdown: scoreBreakdown,
        questionnaire_completed_at: new Date().toISOString(),
        created_by: user.id,
      }
    })

    // Insert repreneurs
    const { data: repreneurs, error: repreneurError } = await supabase
      .from("repreneurs")
      .insert(repreneursWithScores)
      .select()

    if (repreneurError) {
      return NextResponse.json({ error: `Repreneur error: ${repreneurError.message}` }, { status: 500 })
    }

    // Insert offers (skip if already exists)
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

    // Add 2-5 notes to ALL repreneurs
    const notesToInsert = []
    for (const repreneur of repreneurs || []) {
      const numNotes = Math.floor(Math.random() * 4) + 2 // 2-5 notes
      const usedNotes = new Set<number>()

      for (let j = 0; j < numNotes; j++) {
        let noteIndex
        do {
          noteIndex = Math.floor(Math.random() * NOTE_TEMPLATES.length)
        } while (usedNotes.has(noteIndex) && usedNotes.size < NOTE_TEMPLATES.length)
        usedNotes.add(noteIndex)

        // Stagger creation dates (notes from past 30 days)
        const createdAt = new Date()
        createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30))

        notesToInsert.push({
          repreneur_id: repreneur.id,
          content: NOTE_TEMPLATES[noteIndex],
          created_by: user.id,
          created_at: createdAt.toISOString(),
        })
      }
    }

    if (notesToInsert.length > 0) {
      const { error: noteError } = await supabase.from("notes").insert(notesToInsert)
      if (noteError) {
        console.error("Note error:", noteError)
      }
    }

    // Add 3-4 activities to ALL repreneurs
    const activitiesToInsert = []
    for (const repreneur of repreneurs || []) {
      const numActivities = Math.floor(Math.random() * 2) + 3 // 3-4 activities
      const usedActivities = new Set<number>()

      // Always start with welcome email
      const welcomeActivity = ACTIVITY_TEMPLATES.find(a => a.type === "welcome_email")!
      const welcomeDate = new Date()
      welcomeDate.setDate(welcomeDate.getDate() - Math.floor(Math.random() * 60) - 30) // 30-90 days ago

      activitiesToInsert.push({
        repreneur_id: repreneur.id,
        activity_type: welcomeActivity.type,
        notes: welcomeActivity.notes,
        duration_minutes: welcomeActivity.duration || null,
        created_by: user.id,
        created_at: welcomeDate.toISOString(),
      })
      usedActivities.add(0) // Mark welcome email as used

      // Add remaining activities
      for (let j = 1; j < numActivities; j++) {
        let activityIndex
        do {
          activityIndex = Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)
        } while (usedActivities.has(activityIndex) && usedActivities.size < ACTIVITY_TEMPLATES.length)
        usedActivities.add(activityIndex)

        const activity = ACTIVITY_TEMPLATES[activityIndex]

        // Stagger creation dates after welcome email
        const createdAt = new Date(welcomeDate)
        createdAt.setDate(createdAt.getDate() + Math.floor(Math.random() * 25) + (j * 5))

        activitiesToInsert.push({
          repreneur_id: repreneur.id,
          activity_type: activity.type,
          notes: activity.notes,
          duration_minutes: activity.duration || null,
          created_by: user.id,
          created_at: createdAt.toISOString(),
        })
      }
    }

    if (activitiesToInsert.length > 0) {
      const { error: activityError } = await supabase.from("activities").insert(activitiesToInsert)
      if (activityError) {
        console.error("Activity error:", activityError)
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
        activities: activitiesToInsert.length,
        offerAssignments: offersToAssign.length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
