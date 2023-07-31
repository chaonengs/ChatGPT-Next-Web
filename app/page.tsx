"use client";

import { Analytics } from "@vercel/analytics/react";

import { Home } from "./components/home";

import { getServerSideConfig } from "./config/server";

import { useUser } from "@auth0/nextjs-auth0/client";

import { useRouter } from "next/navigation";

// import router from "next/router";

const serverConfig = getServerSideConfig();

export default function App() {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.message}</div>;

  if (user) {
    return (
      <>
        <Home />
        {serverConfig?.isVercel && <Analytics />}
      </>
    );
  } else {
    router.push("/api/auth/login");
  }
}
