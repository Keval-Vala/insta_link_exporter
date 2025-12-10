const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-web-security"
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const url =
    "https://www.tiktok.com/@cleanermasjid/video/7564362246562876690";

  console.log("[TikTok] Opening reel page...");

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });

  await page.waitForTimeout(5000);

  const hasMediaCard = await page.evaluate(() => {
    const elements = document.querySelectorAll('section[id^="media-card"]');
    for (let el of elements) {
      if (el.getAttribute("shape") === "vertical") {
        return true;
      }
    }
    return false;
  });

  console.log(
    hasMediaCard
      ? "✓ Found section with ID starting with 'media-card' and shape='vertical'"
      : "✘ No section found with ID starting with 'media-card' and shape='vertical'"
  );

  await browser.close();
})();
