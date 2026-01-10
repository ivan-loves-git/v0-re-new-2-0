/**
 * Internal distribution lists for email communications
 * Add new groups as needed
 */

export interface Contact {
  name: string;
  email: string;
}

export interface DistributionList {
  name: string;
  description: string;
  contacts: Contact[];
}

// Founders and Team 2.0
export const FOUNDERS_TEAM_2_0: DistributionList = {
  name: "Founders & Team 2.0",
  description: "ESCP EMBA founders group and team 2.0 members",
  contacts: [
    { name: "Amelie Lyon", email: "amelie.lyon@edu.escp.eu" },
    { name: "Antoine Duchene", email: "antoine.duchene@edu.escp.eu" },
    { name: "Alexandre Devulder", email: "alexandre.devulder@sony.com" },
    { name: "Gabriele Betti", email: "Gabriele.Betti@outlook.com" },
    { name: "Ignacio Campos", email: "ignacio.campos@edu.escp.eu" },
    { name: "Ivan Paudice", email: "ivanpaudice@icloud.com" },
    { name: "Piera Gallo", email: "piera.gallo@edu.escp.eu" },
  ],
};

// Helper functions
export function getEmailsAsString(list: DistributionList): string {
  return list.contacts.map((c) => `${c.name} <${c.email}>`).join(", ");
}

export function getEmailsOnly(list: DistributionList): string[] {
  return list.contacts.map((c) => c.email);
}

// All distribution lists for easy reference
export const ALL_LISTS = {
  foundersTeam2_0: FOUNDERS_TEAM_2_0,
  // Add more lists here as needed
};
