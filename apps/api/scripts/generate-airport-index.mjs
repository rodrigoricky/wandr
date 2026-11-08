import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const revision = "64af12951161ed52bc733eb4101224643c48850a";
const sourceUrl = `https://raw.githubusercontent.com/davidmegginson/ourairports-data/${revision}/airports.csv`;
const output = resolve(dirname(fileURLToPath(import.meta.url)), "../data/airport-index.json");

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`OurAirports download failed: HTTP ${response.status}`);
const csv = await response.text();
const rows = parseCsv(csv);
const headers = rows.shift();
if (!headers?.includes("iata_code") || !headers.includes("scheduled_service")) throw new Error("Unexpected OurAirports CSV schema.");
const airports = rows.flatMap((values) => {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  if (!(["large_airport", "medium_airport"].includes(row.type)) || row.scheduled_service !== "yes") return [];
  if (!/^[A-Z]{3}$/.test(row.iata_code) || !/^[A-Z]{2}$/.test(row.iso_country) || !row.name) return [];
  const lat = Number(row.latitude_deg);
  const lon = Number(row.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
  return [{
    iata: row.iata_code,
    name: row.name,
    lat,
    lon,
    countryCode: row.iso_country,
    municipality: row.municipality || null,
    type: row.type,
    region: row.iso_region || null,
    scheduledService: true,
  }];
});
airports.sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.iata.localeCompare(b.iata) || a.name.localeCompare(b.name));
const result = {
  source: "OurAirports public-domain airports.csv",
  sourceUrl: "https://ourairports.com/data/",
  sourceRevision: revision,
  sourceSha256: createHash("sha256").update(csv).digest("hex"),
  generatedAt: "2026-11-08",
  selection: "large/medium airports with a three-letter IATA code and scheduled_service=yes",
  airports,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result)}\n`);
console.log(`Wrote ${airports.length} airports (${(Buffer.byteLength(JSON.stringify(result)) / 1024).toFixed(1)} KiB) to ${output}`);
