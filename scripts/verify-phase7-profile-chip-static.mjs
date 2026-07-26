import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rail = readFileSync("src/components/reader/authenticated-rail.tsx", "utf8");
const portfolio = readFileSync("src/lib/portfolio.ts", "utf8");

assert.match(rail, /username:\s*string\s*\|\s*null/, "Rail profile type must include username.");
assert.match(rail, /\.select\("full_name, role, username"\)/, "Rail must fetch username with the signed-in profile.");
assert.match(rail, /function profileChipHref\(/, "Rail must centralize profile chip destination logic.");
assert.match(
  rail,
  /profile\.role\s*===\s*"journalist"\s*\|\|\s*profile\.role\s*===\s*"editor"/,
  "Journalist and editor profile chips must be eligible for portfolio links.",
);
assert.match(
  rail,
  /href=\{profileChipHref\(profile\)\}/,
  "Profile chip must render as a Next Link using the computed profile destination.",
);
assert.match(
  rail,
  /`\/portfolio\/\$\{profile\.username\}`/,
  "Signed-in journalist and editor chips must link to /portfolio/<username>.",
);
assert.match(
  portfolio,
  /\.in\("role",\s*\["journalist",\s*"editor"\]\)/,
  "Portfolio route must resolve journalist and editor public profiles.",
);

console.log(
  JSON.stringify(
    {
      profileChipFetchesUsername: true,
      journalistEditorProfileChipLinksToPortfolio: true,
      portfolioUrlPattern: "/portfolio/<username>",
    },
    null,
    2,
  ),
);
