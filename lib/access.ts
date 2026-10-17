import { env } from "cloudflare:workers";

export function hasStatsAccess(headers: { get(name: string): string | null }): boolean {
  const expected = env.STATS_ACCESS_TOKEN;
  const provided = /^Bearer ([a-f0-9]{64})$/.exec(headers.get("authorization") || "")?.[1];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || !provided) return false;
  // Compare the full fixed-length capability; no visitor accounts are involved.
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return difference === 0;
}
