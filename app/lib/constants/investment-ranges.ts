export const INVESTMENT_CAPACITY_RANGES = [
  "< 50 000 €",
  "50 000 € - 100 000 €",
  "100 000 € - 250 000 €",
  "250 000 € - 500 000 €",
  "500 000 € - 1 000 000 €",
  "1 000 000 € - 2 500 000 €",
  "> 2 500 000 €",
] as const

export const TARGET_ACQUISITION_SIZE_RANGES = [
  "< 250 000 € CA",
  "250 000 € - 500 000 € CA",
  "500 000 € - 1 000 000 € CA",
  "1 000 000 € - 2 500 000 € CA",
  "2 500 000 € - 5 000 000 € CA",
  "5 000 000 € - 10 000 000 € CA",
  "> 10 000 000 € CA",
] as const

export type InvestmentCapacity = (typeof INVESTMENT_CAPACITY_RANGES)[number]
export type TargetAcquisitionSize = (typeof TARGET_ACQUISITION_SIZE_RANGES)[number]
