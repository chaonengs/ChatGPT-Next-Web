import { NextRequest } from "next/server";
import { UserProfile } from "@auth0/nextjs-auth0/client";

export type Auth0Authentication = {
  authenticated: boolean;
  user: UserProfile;
};

export const getAuth0User = async (
  req: NextRequest,
): Promise<Auth0Authentication> => {
  const res = await fetch(req.nextUrl.origin + "/api/auth/me", {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });

  const user = (await res.json()) as UserProfile;
  return { authenticated: res.ok, user: user };
};
