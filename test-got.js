#!/usr/bin/env bun

import { WebScrapingServiceImpl } from "./packages/shared/dist/services/web-scraping.service.js";

async function testGotScraping() {
  console.log("🕷️ Testing Got-based WebScrapingService...");

  const scraper = new WebScrapingServiceImpl();

  try {
    // Test with a simple webpage that should work
    console.log("📄 Testing with httpbin.org/html...");
    const result = await scraper.scrape("https://httpbin.org/html");

    console.log("✅ Scraping successful!");
    console.log(`📋 Title: ${result.title || "No title found"}`);
    console.log(`📏 Content length: ${result.content.length} characters`);
    console.log(`🖼️ Images found: ${result.images.length}`);
    console.log(`🔗 Links found: ${result.links.length}`);

    // Test URL validation
    console.log("\n🔍 Testing URL validation...");
    console.log(`✅ Valid URL: ${scraper.isValidUrl("https://example.com")}`);
    console.log(`❌ Invalid URL: ${scraper.isValidUrl("not-a-url")}`);
  } catch (error) {
    console.error("❌ Scraping failed:", error.message);
  }

  console.log("🎉 Got-based web scraping test complete!");
}

testGotScraping().catch(console.error);
