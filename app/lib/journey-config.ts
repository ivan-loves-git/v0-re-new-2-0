import { Compass, BookOpen, FileCheck, Trophy } from "lucide-react"
import type { JourneyStage } from "@/lib/types/repreneur"

export const stageConfig: Record<JourneyStage, { label: string; color: string; icon: React.ElementType; description: string }> = {
  explorer: {
    label: "Explorer",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Compass,
    description: "Curious about repreneurship, exploring opportunities",
  },
  learner: {
    label: "Learner",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: BookOpen,
    description: "Building skills and knowledge for acquisition",
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: FileCheck,
    description: "Prepared to write LOIs and make offers",
  },
  serial_acquirer: {
    label: "Serial Acquirer",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Trophy,
    description: "Experienced buyer with multiple acquisitions",
  },
}
