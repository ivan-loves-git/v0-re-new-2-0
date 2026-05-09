import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixRLS() {
  console.log("Fixing RLS policies for repreneurs table...")

  // We can't run raw SQL via the client, but we can verify the issue
  // and provide instructions

  // Test with service role (bypasses RLS)
  const { data: serviceData, count: serviceCount } = await supabase
    .from("repreneurs")
    .select("*", { count: "exact" })
    .limit(1)

  console.log(`Service role can see ${serviceCount} repreneurs`)

  // Test with simulated auth (won't work in this script, but documents the issue)
  console.log("\nThe issue: RLS policies are blocking authenticated users.")
  console.log("\nTo fix, run this SQL in Supabase Dashboard > SQL Editor:\n")

  console.log(`
-- Fix RLS policies for repreneurs table
DROP POLICY IF EXISTS "Allow authenticated users to read repreneurs" ON repreneurs;
DROP POLICY IF EXISTS "Users can view own repreneurs" ON repreneurs;

CREATE POLICY "Allow authenticated users to read repreneurs"
ON repreneurs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update repreneurs" ON repreneurs;
CREATE POLICY "Allow authenticated users to update repreneurs"
ON repreneurs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to insert repreneurs" ON repreneurs;
CREATE POLICY "Allow public to insert repreneurs"
ON repreneurs FOR INSERT
TO anon, authenticated
WITH CHECK (true);
  `)

  console.log("\n---")
  console.log("Go to: https://supabase.com/dashboard/project/iiuqcdnmxhtyispnykgf/sql")
  console.log("Paste the SQL above and run it.")
}

fixRLS().catch(console.error)
