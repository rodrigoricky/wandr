import { describe, expect, it } from "vitest";
import { corsHeaders } from "../src/lib/cors";

describe("origin allowlist", () => {
  it("allows only explicitly configured browser origins", () => {
    const env = { ALLOWED_ORIGINS: "https://wandr.example, http://localhost:3000" };
    expect(corsHeaders(new Request("https://api.test", { headers: { Origin: "https://wandr.example" } }), env).get("Access-Control-Allow-Origin")).toBe("https://wandr.example");
    expect(corsHeaders(new Request("https://api.test", { headers: { Origin: "https://attacker.example" } }), env).get("Access-Control-Allow-Origin")).toBeNull();
  });
});
