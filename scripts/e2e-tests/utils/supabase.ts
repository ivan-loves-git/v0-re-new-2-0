/**
 * Supabase Data Validator
 *
 * Provides database queries for validating test results against actual data.
 * Uses the same Supabase client pattern as the main app.
 */

import { createClient } from "@supabase/supabase-js"
import type {
  DataValidator,
  Repreneur,
  Offer,
  Note,
  LifecycleStatus
} from "../types"
import { TEST_CONFIG } from "../config"

// Initialize Supabase client for testing
// Note: In production, these would come from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let supabaseClient: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!supabaseClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
      )
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseClient
}

/**
 * Create a DataValidator instance for test assertions
 */
export function createDataValidator(): DataValidator {
  const client = getClient()

  return {
    /**
     * Get count of repreneurs, optionally filtered by status
     */
    async getRepreneurCount(status?: string): Promise<number> {
      let query = client
        .from("repreneurs")
        .select("id", { count: "exact", head: true })

      if (status) {
        query = query.eq("lifecycle_status", status)
      }

      // Exclude test data from counts
      query = query.not("first_name", "like", `${TEST_CONFIG.testData.prefix}%`)

      const { count, error } = await query

      if (error) {
        console.error("Error getting repreneur count:", error)
        return 0
      }

      return count || 0
    },

    /**
     * Get a single repreneur by ID
     */
    async getRepreneurById(id: string): Promise<Repreneur | null> {
      const { data, error } = await client
        .from("repreneurs")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error("Error getting repreneur:", error)
        return null
      }

      return data as Repreneur
    },

    /**
     * Get a single repreneur by email
     */
    async getRepreneurByEmail(email: string): Promise<Repreneur | null> {
      const { data, error } = await client
        .from("repreneurs")
        .select("*")
        .eq("email", email)
        .single()

      if (error) {
        console.error("Error getting repreneur by email:", error)
        return null
      }

      return data as Repreneur
    },

    /**
     * Get count of offers
     */
    async getOfferCount(): Promise<number> {
      const { count, error } = await client
        .from("offers")
        .select("id", { count: "exact", head: true })
        .not("name", "like", `${TEST_CONFIG.testData.prefix}%`)

      if (error) {
        console.error("Error getting offer count:", error)
        return 0
      }

      return count || 0
    },

    /**
     * Get a single offer by ID
     */
    async getOfferById(id: string): Promise<Offer | null> {
      const { data, error } = await client
        .from("offers")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error("Error getting offer:", error)
        return null
      }

      return data as Offer
    },

    /**
     * Get all notes for a repreneur
     */
    async getNotesByRepreneurId(repreneurId: string): Promise<Note[]> {
      const { data, error } = await client
        .from("notes")
        .select("*")
        .eq("repreneur_id", repreneurId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error getting notes:", error)
        return []
      }

      return data as Note[]
    },

    /**
     * Verify a repreneur's Tier 1 score matches expected value
     */
    async verifyTier1Score(id: string, expectedScore: number): Promise<boolean> {
      const repreneur = await this.getRepreneurById(id)
      if (!repreneur) return false
      return repreneur.tier1_score === expectedScore
    }
  }
}

/**
 * Get counts by lifecycle status (for dashboard validation)
 */
export async function getCountsByStatus(): Promise<Record<LifecycleStatus, number>> {
  const client = getClient()
  const statuses: LifecycleStatus[] = ["lead", "qualified", "client", "rejected"]
  const counts: Record<string, number> = {}

  for (const status of statuses) {
    const { count } = await client
      .from("repreneurs")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", status)
      .not("first_name", "like", `${TEST_CONFIG.testData.prefix}%`)

    counts[status] = count || 0
  }

  return counts as Record<LifecycleStatus, number>
}

/**
 * Get counts by journey stage
 */
export async function getCountsByJourneyStage(): Promise<Record<string, number>> {
  const client = getClient()
  const stages = ["explorer", "learner", "ready", "serial_acquirer"]
  const counts: Record<string, number> = {}

  for (const stage of stages) {
    const { count } = await client
      .from("repreneurs")
      .select("id", { count: "exact", head: true })
      .eq("journey_stage", stage)
      .not("first_name", "like", `${TEST_CONFIG.testData.prefix}%`)

    counts[stage] = count || 0
  }

  return counts
}

/**
 * Get top Tier 1 scored repreneurs
 */
export async function getTopTier1Repreneurs(limit: number = 5): Promise<Repreneur[]> {
  const client = getClient()

  const { data, error } = await client
    .from("repreneurs")
    .select("*")
    .not("tier1_score", "is", null)
    .not("first_name", "like", `${TEST_CONFIG.testData.prefix}%`)
    .order("tier1_score", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error getting top Tier 1 repreneurs:", error)
    return []
  }

  return data as Repreneur[]
}

/**
 * Get top Tier 2 rated repreneurs
 */
export async function getTopTier2Repreneurs(limit: number = 5): Promise<Repreneur[]> {
  const client = getClient()

  const { data, error } = await client
    .from("repreneurs")
    .select("*")
    .not("tier2_stars", "is", null)
    .not("first_name", "like", `${TEST_CONFIG.testData.prefix}%`)
    .order("tier2_stars", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error getting top Tier 2 repreneurs:", error)
    return []
  }

  return data as Repreneur[]
}
