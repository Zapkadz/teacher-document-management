import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getPrismaClient } from "@/lib/db/prisma";
import { evaluateGoogleAccess } from "@/modules/auth/google-access";

const prisma = getPrismaClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The generated Prisma 7 client is structurally compatible with the adapter,
  // while the adapter package still declares the default @prisma/client type.
  adapter: PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0],
  ),
  session: {
    strategy: "database",
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      // Accounts are provisioned by an admin before their first Google login.
      // Google supplies a verified email and signIn rechecks the DB allowlist.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      const result = await evaluateGoogleAccess(
        {
          email: profile?.email,
          emailVerified:
            "email_verified" in (profile ?? {})
              ? profile?.email_verified === true
              : false,
        },
        (email) =>
          prisma.user.findUnique({
            where: { email },
            select: { id: true, status: true },
          }),
      );

      if (!result.allowed) {
        const deniedUserId =
          "user" in result ? (result.user?.id ?? null) : null;

        await prisma.auditLog.create({
          data: {
            actorUserId: deniedUserId,
            action: "LOGIN_REJECTED",
            entityType: "AUTH",
            entityId: deniedUserId,
            metadata: {
              email: "email" in result ? result.email : null,
              reason: result.reason,
            },
          },
        });
      }

      return result.allowed;
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.globalRole = user.globalRole;
      session.user.status = user.status;
      return session;
    },
    authorized({ auth: session, request }) {
      const user = session?.user;

      if (!user || user.status !== "ACTIVE") {
        return false;
      }

      if (
        request.nextUrl.pathname.startsWith("/admin") &&
        user.globalRole !== "ADMIN"
      ) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
  },
  events: {
    async signIn({ user }) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "LOGIN_SUCCEEDED",
            entityType: "AUTH",
            entityId: user.id,
            metadata: { provider: "google" },
          },
        }),
      ]);
    },
  },
});
