const { WebScrapingServiceImpl } = require("./packages/shared/dist/services/web-scraping.service");
const { CosmicHttpClient } = require("./packages/shared/dist/services/http-client");

const scraper = new WebScrapingServiceImpl(new CosmicHttpClient());

console.log("127.0.0.1:", scraper.isValidUrl("http://127.0.0.1"));
console.log("2130706433:", scraper.isValidUrl("http://2130706433"));
console.log("localhost:", scraper.isValidUrl("http://localhost"));
console.log("google.com:", scraper.isValidUrl("http://google.com"));
