import { CosmicHttpClient } from "./packages/shared/src/services/http-client";

async function main() {
  const client = new CosmicHttpClient();
  try {
    console.log("Testing localhost...");
    await client.fetch("http://localhost:3000/");
    console.error("FAIL: Should have blocked localhost");
  } catch (err) {
    console.log("PASS:", err.message);
  }

  try {
    console.log("Testing external URL...");
    const res = await client.fetch("https://example.com/");
    console.log("PASS: Successfully fetched external URL. Status:", res.status);
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}
main();
