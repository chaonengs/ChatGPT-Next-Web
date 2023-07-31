import { type OpenAIListModelResponse } from "@/app/client/platforms/openai";
import { getServerSideConfig } from "@/app/config/server";
import { OpenaiPath } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../default-auth";
import { requestOpenai } from "../../common";
import * as auth0 from "@auth0/nextjs-auth0/edge";
import { getAuth0User } from "@/app/utils/auth0";
import { kv } from "@vercel/kv";
import { UserProfile } from "@auth0/nextjs-auth0/client";

const ALLOWD_PATH = new Set(Object.values(OpenaiPath));
const config = getServerSideConfig();

function getModels(remoteModelRes: OpenAIListModelResponse) {
  if (config.disableGPT4) {
    remoteModelRes.data = remoteModelRes.data.filter(
      (m) => !m.id.startsWith("gpt-4"),
    );
  }

  return remoteModelRes;
}

async function addQuery(userId: string) {
  await kv.lpush(`query:${userId}`, new Date().getTime());
}

async function handleQueryRateCheck(user: UserProfile): Promise<boolean> {
  const redisKey = `query:${user.sub}`;
  if (user.plan === "hobby") {
    const count = await kv.llen(redisKey);
    if (count < config.hobbyLimitQueries) {
      await kv.lpush(redisKey, new Date().getTime());
      return false;
    } else {
      const oldest = Number.parseInt((await kv.lrange(redisKey, 0, 0))[0]);
      if (oldest + config.hobbyLimitDuration * 1000 > new Date().getTime()) {
        return true;
      } else {
        await kv.lpush(redisKey, new Date().getTime());
        await kv.ltrim(redisKey, 0, 2);
        return false;
      }
    }
  }
  return false;
}

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[OpenAI Route] params ", params);
  const { authenticated, user } = await getAuth0User(req);
  console.log("[OpenAI Route] user ", user);
  console.log("[OpenAI Route] user plan ", user.plan);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[OpenAI Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = auth(req);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  const exceedLimitation = await handleQueryRateCheck(user);
  if (exceedLimitation) {
    return NextResponse.json(
      {
        error: true,
        msg: "You have reached request rate limitation",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const response = await requestOpenai(req);

    // list models
    if (subpath === OpenaiPath.ListModelPath && response.status === 200) {
      const resJson = (await response.json()) as OpenAIListModelResponse;
      const availableModels = getModels(resJson);
      return NextResponse.json(availableModels, {
        status: response.status,
      });
    }

    return response;
  } catch (e) {
    console.error("[OpenAI] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
