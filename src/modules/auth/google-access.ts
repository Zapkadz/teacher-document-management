export type GoogleAccessDenial =
  "EMAIL_NOT_VERIFIED" | "EMAIL_NOT_ALLOWLISTED" | "ACCOUNT_NOT_ACTIVE";

export type AllowlistedUser = {
  id: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
};

type GoogleIdentity = {
  email?: string | null;
  emailVerified?: boolean | null;
};

export async function evaluateGoogleAccess(
  identity: GoogleIdentity,
  findUserByEmail: (email: string) => Promise<AllowlistedUser | null>,
) {
  if (!identity.email || identity.emailVerified !== true) {
    return { allowed: false as const, reason: "EMAIL_NOT_VERIFIED" as const };
  }

  const email = identity.email.trim().toLowerCase();
  const user = await findUserByEmail(email);

  if (!user) {
    return {
      allowed: false as const,
      reason: "EMAIL_NOT_ALLOWLISTED" as const,
      email,
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      allowed: false as const,
      reason: "ACCOUNT_NOT_ACTIVE" as const,
      email,
      user,
    };
  }

  return { allowed: true as const, email, user };
}
