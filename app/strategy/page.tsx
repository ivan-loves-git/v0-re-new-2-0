import type { Metadata } from "next"
import { StrategyExplorer } from "@/components/strategy/strategy-explorer"

export const metadata: Metadata = {
  title: "Strategy Explorer | Re-New",
  description: "Interactive Platform Vision V2.0 - Explore the repreneur acquisition journey, readiness dimensions, and revenue model.",
}

export default function StrategyPage() {
  return <StrategyExplorer />
}
