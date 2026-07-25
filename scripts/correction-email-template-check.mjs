import assert from "node:assert/strict";

const resendApiKey = process.env.RESEND_API_KEY;
assert.ok(resendApiKey, "Missing RESEND_API_KEY");

const expected = [
  {
    key: "newsletter",
    subject: "CampusPress AI newsletter confirmation",
  },
  {
    key: "signupConfirmation",
    subject: "Confirm your CampusPress AI account",
  },
  {
    key: "passwordRecovery",
    subject: "Reset your CampusPress AI password",
  },
];

const results = [];

for (const item of expected) {
  const email = await latestDeliveredEmail(item.subject);
  const content = `${email.html ?? ""}\n${email.text ?? ""}`;
  assert.match(content, /chrisland-logo\.webp/i, `${item.key} email must include Chrisland logo`);
  assert.match(content, /CampusPress AI/i, `${item.key} email must include CampusPress AI branding`);
  assert.match(content, /#4c1d95/i, `${item.key} email must include CampusPress purple`);
  assert.match(content, /#c9a227/i, `${item.key} email must include Chrisland gold`);

  results.push({
    key: item.key,
    subject: email.subject,
    id: email.id,
    created_at: email.created_at,
    last_event: email.last_event,
    hasLogo: /chrisland-logo\.webp/i.test(content),
    hasPurpleBrandColor: /#4c1d95/i.test(content),
    hasGoldAccent: /#c9a227/i.test(content),
  });
}

console.log(JSON.stringify({ brandedDeliveredEmails: results }, null, 2));

async function latestDeliveredEmail(subject) {
  const list = await resend("/emails?limit=100");
  const candidate = (list.data ?? [])
    .filter((email) => email.subject === subject)
    .filter((email) => email.last_event === "delivered")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  assert.ok(candidate, `Expected a delivered Resend email with subject "${subject}"`);
  return resend(`/emails/${candidate.id}`);
}

async function resend(path) {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Resend API failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}
