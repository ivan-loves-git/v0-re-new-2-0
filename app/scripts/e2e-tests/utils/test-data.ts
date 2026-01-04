/**
 * Test Data Manager
 *
 * Handles seeding test data and cleanup.
 * All test records are prefixed with TEST_E2E_ for easy identification and cleanup.
 */

import { createClient } from "@supabase/supabase-js"
import type { TestDataManager, RepreneurInsert, OfferInsert } from "../types"
import { TEST_CONFIG } from "../config"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let supabaseClient: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseClient
}

// Track created IDs for cleanup
const createdIds = {
  repreneurs: [] as string[],
  offers: [] as string[],
  notes: [] as string[],
}

/**
 * Generate a unique test email
 */
function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${TEST_CONFIG.testData.prefix.toLowerCase()}${timestamp}_${random}${TEST_CONFIG.testData.emailDomain}`
}

/**
 * Create a TestDataManager instance
 */
export function createTestDataManager(): TestDataManager {
  const client = getClient()

  return {
    /**
     * Create a test repreneur
     */
    async seedTestRepreneur(data: Partial<RepreneurInsert>): Promise<string> {
      const testData: RepreneurInsert = {
        first_name: `${TEST_CONFIG.testData.prefix}${data.first_name || "Test"}`,
        last_name: data.last_name || "User",
        email: data.email || generateTestEmail(),
        phone: data.phone,
        lifecycle_status: data.lifecycle_status || "lead",
        journey_stage: data.journey_stage || "explorer",
        sector_preferences: data.sector_preferences,
        investment_capacity: data.investment_capacity,
        target_acquisition_size: data.target_acquisition_size,
        target_location: data.target_location,
        company_background: data.company_background,
      }

      const { data: inserted, error } = await client
        .from("repreneurs")
        .insert(testData)
        .select("id")
        .single()

      if (error) {
        throw new Error(`Failed to seed test repreneur: ${error.message}`)
      }

      createdIds.repreneurs.push(inserted.id)
      console.log(`[TestData] Created repreneur: ${inserted.id} (${testData.email})`)
      return inserted.id
    },

    /**
     * Create a test offer
     */
    async seedTestOffer(data: Partial<OfferInsert>): Promise<string> {
      const testData: OfferInsert = {
        name: `${TEST_CONFIG.testData.prefix}${data.name || "Test Offer"}`,
        description: data.description || "Test offer created by E2E tests",
        price: data.price || 999,
        duration_days: data.duration_days || 30,
        acceptance_deadline_days: data.acceptance_deadline_days || 14,
        includes_hours: data.includes_hours || 5,
        includes_resources: data.includes_resources ?? true,
        is_active: data.is_active ?? true,
      }

      const { data: inserted, error } = await client
        .from("offers")
        .insert(testData)
        .select("id")
        .single()

      if (error) {
        throw new Error(`Failed to seed test offer: ${error.message}`)
      }

      createdIds.offers.push(inserted.id)
      console.log(`[TestData] Created offer: ${inserted.id} (${testData.name})`)
      return inserted.id
    },

    /**
     * Create a test note for a repreneur
     */
    async seedTestNote(repreneurId: string, content: string): Promise<string> {
      const { data: inserted, error } = await client
        .from("notes")
        .insert({
          repreneur_id: repreneurId,
          content: `${TEST_CONFIG.testData.prefix}${content}`,
          note_type: "other",
        })
        .select("id")
        .single()

      if (error) {
        throw new Error(`Failed to seed test note: ${error.message}`)
      }

      createdIds.notes.push(inserted.id)
      console.log(`[TestData] Created note: ${inserted.id}`)
      return inserted.id
    },

    /**
     * Clean up all test data
     */
    async cleanup(): Promise<void> {
      console.log("[TestData] Starting cleanup...")

      // Delete in order to respect foreign key constraints

      // 1. Delete notes by ID (tracked)
      if (createdIds.notes.length > 0) {
        const { error: notesError } = await client
          .from("notes")
          .delete()
          .in("id", createdIds.notes)

        if (notesError) {
          console.error("[TestData] Error deleting tracked notes:", notesError)
        } else {
          console.log(`[TestData] Deleted ${createdIds.notes.length} tracked notes`)
        }
      }

      // 2. Delete any notes with test prefix (safety net)
      const { error: notesPatternError } = await client
        .from("notes")
        .delete()
        .like("content", `${TEST_CONFIG.testData.prefix}%`)

      if (notesPatternError) {
        console.error("[TestData] Error deleting pattern-matched notes:", notesPatternError)
      }

      // 3. Delete repreneur_offers for test repreneurs
      if (createdIds.repreneurs.length > 0) {
        const { error: roError } = await client
          .from("repreneur_offers")
          .delete()
          .in("repreneur_id", createdIds.repreneurs)

        if (roError) {
          console.error("[TestData] Error deleting repreneur_offers:", roError)
        }
      }

      // 4. Delete activities for test repreneurs
      if (createdIds.repreneurs.length > 0) {
        const { error: actError } = await client
          .from("activities")
          .delete()
          .in("repreneur_id", createdIds.repreneurs)

        if (actError) {
          console.error("[TestData] Error deleting activities:", actError)
        }
      }

      // 5. Delete repreneurs by ID (tracked)
      if (createdIds.repreneurs.length > 0) {
        const { error: repreneursError } = await client
          .from("repreneurs")
          .delete()
          .in("id", createdIds.repreneurs)

        if (repreneursError) {
          console.error("[TestData] Error deleting tracked repreneurs:", repreneursError)
        } else {
          console.log(`[TestData] Deleted ${createdIds.repreneurs.length} tracked repreneurs`)
        }
      }

      // 6. Delete any repreneurs with test prefix (safety net)
      const { error: repreneursPatternError } = await client
        .from("repreneurs")
        .delete()
        .like("first_name", `${TEST_CONFIG.testData.prefix}%`)

      if (repreneursPatternError) {
        console.error("[TestData] Error deleting pattern-matched repreneurs:", repreneursPatternError)
      }

      // 7. Delete offers by ID (tracked)
      if (createdIds.offers.length > 0) {
        const { error: offersError } = await client
          .from("offers")
          .delete()
          .in("id", createdIds.offers)

        if (offersError) {
          console.error("[TestData] Error deleting tracked offers:", offersError)
        } else {
          console.log(`[TestData] Deleted ${createdIds.offers.length} tracked offers`)
        }
      }

      // 8. Delete any offers with test prefix (safety net)
      const { error: offersPatternError } = await client
        .from("offers")
        .delete()
        .like("name", `${TEST_CONFIG.testData.prefix}%`)

      if (offersPatternError) {
        console.error("[TestData] Error deleting pattern-matched offers:", offersPatternError)
      }

      // Reset tracked IDs
      createdIds.repreneurs = []
      createdIds.offers = []
      createdIds.notes = []

      console.log("[TestData] Cleanup complete")
    },

    /**
     * Get all created IDs (for reference)
     */
    getCreatedIds() {
      return { ...createdIds }
    }
  }
}

/**
 * Seed standard test data for a full test run
 */
export async function seedStandardTestData(): Promise<{
  repreneurs: { lead: string; qualified: string; client: string }
  offers: { standard: string }
}> {
  const manager = createTestDataManager()

  console.log("[TestData] Seeding standard test data...")

  // Create 3 repreneurs with different statuses
  const leadId = await manager.seedTestRepreneur({
    first_name: "Lead",
    last_name: "Candidate",
    lifecycle_status: "lead",
    journey_stage: "explorer",
    investment_capacity: "151_250",
    target_acquisition_size: "1m_3m",
  })

  const qualifiedId = await manager.seedTestRepreneur({
    first_name: "Qualified",
    last_name: "Candidate",
    lifecycle_status: "qualified",
    journey_stage: "learner",
    investment_capacity: "251_350",
    target_acquisition_size: "3m_5m",
  })

  const clientId = await manager.seedTestRepreneur({
    first_name: "Client",
    last_name: "Active",
    lifecycle_status: "client",
    journey_stage: "ready",
    investment_capacity: "450_plus",
    target_acquisition_size: "5m_10m",
  })

  // Create a test offer
  const offerId = await manager.seedTestOffer({
    name: "Standard Pack",
    description: "Standard consulting package for testing",
    price: 1249,
    duration_days: 90,
    includes_hours: 10,
  })

  // Add notes to the qualified repreneur
  await manager.seedTestNote(qualifiedId, "Initial contact made via LinkedIn")
  await manager.seedTestNote(qualifiedId, "First call completed - very engaged")

  console.log("[TestData] Standard test data seeded")

  return {
    repreneurs: {
      lead: leadId,
      qualified: qualifiedId,
      client: clientId,
    },
    offers: {
      standard: offerId,
    }
  }
}
