"use server";

import { auth } from "@clerk/nextjs/server";

import { getProviderLimits as load, type ProviderLimits } from "@/lib/provider-limits";

export async function getProviderLimits(): Promise<ProviderLimits> {
  const { userId } = await auth();
  return userId ? load() : { ok: false };
}
