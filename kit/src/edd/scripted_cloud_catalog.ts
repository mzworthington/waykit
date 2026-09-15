/**
 * Keyword stop for Cloud Agent / Automation loops.
 * Local `wk mcp --install` does not wake a hosted catalog.
 */

const SOP_LOOKUP =
  /\bopen the kit sop\b|\bget_sop\b|\bwhich sop\b|\bkit sop for\b/;

const HOSTED_SESSION =
  /\bcloud agent\b|\bautomation session\b|\bhosted cloud\b|\bcursor dashboard\b/;

const CATALOG_MISSING =
  /\b(missing|not connected|absent)\b.*\b(dashboard|catalog)\b|\b(dashboard|catalog)\b.*\b(missing|not connected|absent)\b/;

const LOCAL_PROFILE_IN_CLOUD =
  /\blocal profile\b|\bwk mcp --install\b|~\/\.cursor\/mcp/;

export const CLOUD_CATALOG_STOP_CONTENT =
  'BLOCKED coverage. GitHub, Linear, PostHog, Cloudflare Observability, and SonarQube must be connected on the Cursor dashboard. wk mcp --install only rewrites local host files and does not wake this Cloud catalog. I will not invent site lists, issue lists, or dashboard counts.';

export function cloudCatalogShouldStop(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (SOP_LOOKUP.test(p)) return false;
  if (!HOSTED_SESSION.test(p)) return false;
  return CATALOG_MISSING.test(p) || LOCAL_PROFILE_IN_CLOUD.test(p);
}
