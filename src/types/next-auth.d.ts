import type { DefaultSession } from "next-auth";

import type { GlobalRole, UserStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      globalRole: GlobalRole;
      status: UserStatus;
    };
  }

  interface User {
    globalRole: GlobalRole;
    status: UserStatus;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    globalRole: GlobalRole;
    status: UserStatus;
  }
}
