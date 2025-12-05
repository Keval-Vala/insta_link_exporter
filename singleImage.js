const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    const page = await browser.newPage();

    const url = "https://www.instagram.com/p/DJdy-uwMlcR/";
    console.log("[Instagram] Opening Instagram post...");
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for at least one image to load
    await page.waitForSelector("img");

    // Get all image URLs
    const imageUrls = await page.$$eval("img", imgs =>
        imgs.map(img => img.src)
    );

    // Save URLs as plain text, one per line
    fs.writeFileSync("result.txt", imageUrls.join("\n"), "utf-8");

    console.log("[Instagram] Saved image URLs to result.txt");

    await browser.close();
})();
