import fs from "node:fs/promises";
import path from "node:path";
import { applyCors } from "./_google.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const file = path.join(process.cwd(), "data", "events.json");
  const events = JSON.parse(await fs.readFile(file, "utf8"));

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ ok: true, ...events });
}
