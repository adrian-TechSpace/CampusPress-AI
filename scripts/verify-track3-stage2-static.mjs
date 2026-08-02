import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = read("supabase/migrations/202608020002_track3_role_portfolios.sql");
const portfolioLib = read("src/lib/portfolio.ts");
const portfolioPage = read("src/components/portfolio/portfolio-page.tsx");
const route = read("src/app/portfolio/[username]/page.tsx");

assert.match(migration, /create table if not exists public\.profile_public_settings/i, "Reader portfolio settings table must exist.");
assert.match(migration, /show_liked_articles boolean not null default false/i, "Liked articles must be opt-in.");
assert.match(migration, /show_public_comments boolean not null default false/i, "Public comments must be opt-in.");
assert.match(migration, /grant select on public\.profile_public_settings to anon, authenticated/i, "Public settings select grant must be explicit.");
assert.match(migration, /profile owners manage public settings/i, "Owners must be able to manage their own settings.");

assert.match(portfolioLib, /loadRolePortfolio/, "Portfolio route must load all roles.");
assert.match(portfolioLib, /followerCount/, "Role portfolios must include real follower counts where approved.");
assert.match(portfolioLib, /loadReaderActivity/, "Reader activity must be loaded only through the opt-in helper.");
assert.match(portfolioLib, /show_liked_articles/, "Reader liked articles must depend on opt-in settings.");
assert.match(portfolioLib, /show_public_comments/, "Reader comments must depend on opt-in settings.");
assert.match(portfolioLib, /loadEditorStats/, "Editor portfolios must include review stats.");
assert.doesNotMatch(portfolioLib, /ai_analyses[\s\S]*editorStats/, "Editor stats must not read AI analysis contents.");

assert.match(portfolioPage, /data-testid="role-portfolio"/, "Portfolio component must render role-aware portfolios.");
assert.match(portfolioPage, /Reader activity is private unless this reader chooses to share it/, "Reader privacy copy must be present.");
assert.match(portfolioPage, /Articles reviewed/, "Editor review count must render.");
assert.match(portfolioPage, /Approved articles/, "Editor approved count must render.");
assert.match(portfolioPage, /Administrator profile/, "Admin portfolios must render as minimal identity pages.");
assert.match(portfolioPage, /Subadministrator profile/, "Subadmin portfolios must render as minimal identity pages.");
assert.match(route, /loadRolePortfolio/, "Portfolio route must call the role-aware loader.");

console.log(JSON.stringify({ ok: true, stage: "track3-stage2-role-portfolios" }, null, 2));

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
