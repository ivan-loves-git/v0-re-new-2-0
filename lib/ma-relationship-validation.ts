export function isValidMaRelationshipEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function maContactProfileErrors(
  fields: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  },
  prefix = "",
): Record<string, string> {
  const errors: Record<string, string> = {};
  const firstName = fields.firstName?.trim();
  const lastName = fields.lastName?.trim();
  const email = fields.email?.trim();
  const phone = fields.phone?.trim();
  if (!firstName && !lastName) {
    errors[`${prefix}first_name`] = "Add a first name or last name.";
    errors[`${prefix}last_name`] = "Add a first name or last name.";
  }
  if (email && !isValidMaRelationshipEmail(email)) {
    errors[`${prefix}email`] =
      "Enter a valid email address, or leave it blank.";
  }
  if (!email && !phone) {
    errors[`${prefix}email`] = "Add an email address or phone number.";
    errors[`${prefix}phone`] = "Add an email address or phone number.";
  }
  return errors;
}
