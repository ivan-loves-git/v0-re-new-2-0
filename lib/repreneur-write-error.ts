interface RepreneurWriteError {
  code?: string | null
  message?: string | null
}

export function repreneurWriteErrorMessage(error: RepreneurWriteError) {
  if (error.code === "23505" && error.message?.toLowerCase().includes("email")) {
    return "This email already belongs to another Repreneur. Open the existing profile or use a different email."
  }

  return "We could not save this Repreneur. Please try again."
}
