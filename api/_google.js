import { google } from "googleapis";
import { decodeProtectedHeader, importX509, jwtVerify } from "jose";

const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let firebaseCertCache = {
  expiresAt: 0,
  certs: {}
};

export function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (origin && configured.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  return {};
}

export async function verifyFirebaseIdToken(idToken) {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Missing FIREBASE_PROJECT_ID");
  }

  if (!idToken) {
    const error = new Error("Missing idToken");
    error.statusCode = 401;
    throw error;
  }

  const { kid, alg } = decodeProtectedHeader(idToken);
  if (alg !== "RS256" || !kid) {
    const error = new Error("Invalid Firebase token header");
    error.statusCode = 401;
    throw error;
  }

  const certs = await getFirebaseCerts();
  const cert = certs[kid];
  if (!cert) {
    const error = new Error("Unknown Firebase token key");
    error.statusCode = 401;
    throw error;
  }

  const key = await importX509(cert, "RS256");
  const { payload } = await jwtVerify(idToken, key, {
    audience: process.env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`
  });

  if (payload.email && payload.email_verified === false) {
    const error = new Error("Email not verified");
    error.statusCode = 401;
    throw error;
  }

  return {
    sub: payload.uid,
    email: payload.email || "",
    name: payload.name || "",
    picture: payload.picture || "",
    provider: payload.firebase?.sign_in_provider || ""
  };
}

async function getFirebaseCerts() {
  if (Date.now() < firebaseCertCache.expiresAt && Object.keys(firebaseCertCache.certs).length) {
    return firebaseCertCache.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch Firebase public keys");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  firebaseCertCache = {
    certs: await response.json(),
    expiresAt: Date.now() + (maxAgeSeconds * 1000)
  };

  return firebaseCertCache.certs;
}
