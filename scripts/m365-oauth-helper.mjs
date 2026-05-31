const mode = process.argv[2] || "url";
const code = process.argv[3] || "";

const tenantId = process.env.M365_TENANT_ID || "common";
const clientId = process.env.M365_CLIENT_ID || "";
const clientSecret = process.env.M365_CLIENT_SECRET || "";
const redirectUri = process.env.M365_REDIRECT_URI || "http://localhost";
const senderEmail = process.env.M365_SENDER_EMAIL || "";
const scopes = "openid offline_access https://graph.microsoft.com/Mail.Send";

function requireValue(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
}

async function printUrl() {
  requireValue("M365_CLIENT_ID", clientId);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
    prompt: "consent"
  });

  console.log(`Authorize mailbox${senderEmail ? ` ${senderEmail}` : ""}:`);
  console.log(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`);
}

async function exchangeCode() {
  requireValue("M365_CLIENT_ID", clientId);
  requireValue("M365_CLIENT_SECRET", clientSecret);
  requireValue("authorization code", code);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: scopes
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();

  if (!response.ok) {
    console.error(payload);
    process.exit(1);
  }

  console.log("Set this in Vercel:");
  console.log(`M365_REFRESH_TOKEN=${payload.refresh_token}`);
}

if (mode === "exchange") {
  await exchangeCode();
} else {
  await printUrl();
}
