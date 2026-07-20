import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashToken, verifyAdminPassword, verifyAdminRequest, verifyPkce } from "../src/lib/auth.mjs";

describe("OAuth helpers", () => {
  it("verifies an RFC 7636 S256 PKCE challenge", () => {
    const verifier = "test-verifier-with-enough-entropy-0123456789";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce("wrong-verifier", challenge)).toBe(false);
  });

  it("hashes secrets without returning the original", () => {
    expect(hashToken("secret")).not.toContain("secret");
  });
  it("uses deliberate open-access mode without a user password", async () => {
    expect(verifyAdminPassword("")).toBe(true);
    expect(await verifyAdminRequest(new Request("https://example.test/api/vault/files"))).toBe(true);
  });

});
