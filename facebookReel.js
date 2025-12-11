const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    const page = await browser.newPage();

    // Store captured media URLs here
    const mediaUrls = [];

    // Helper: remove bytestart and byteend
    function cleanMediaUrl(url) {
        // Remove bytestart and byteend parameters
        url = url.replace(/([&?])(bytestart|byteend)=[^&]+(&?)/g, (match, p1, p2, p3) => {
            if (p1 === '?' && !p3) return ''; // ?param at the end
            if (p1 === '?' && p3) return '?'; // ?param&nextParam
            if (p1 === '&') return p3 ? '&' : ''; // &param or &param at the end
            return '';
        });

        // Remove trailing '?' if present
        url = url.replace(/\?$/, '');

        return url;
    }

    // Listen to all network responses
    page.on("response", async (response) => {
        try {
            const request = response.request();
            const url = request.url();
            const resourceType = request.resourceType();

            // Filter only media requests (video or audio)
            if (resourceType === "media" || url.match(/\.(mp4|m3u8|mp3|wav|webm|ogg)(\?|$)/i)) {
                const cleanUrl = cleanMediaUrl(url);
                console.log(`[Network] Media detected: ${cleanUrl}`);
                mediaUrls.push(cleanUrl);
            }
        } catch (e) {
            // Ignore any errors
        }
    });

    const reelUrl = "https://www.facebook.com/reel/1973810940040826";
    console.log("[Facebook] Opening reel...");
    await page.goto(reelUrl, { waitUntil: "networkidle2" });

    // Wait for the login popup and close it if present
    try {
        await page.waitForSelector('div[aria-label="Close"]', { timeout: 5000 });
        await page.click('div[aria-label="Close"]');
        console.log("[Facebook] Closed login popup.");
    } catch (err) {
        console.log("[Facebook] Close button not found or timeout.");
    }

    // Wait for some time to let media requests finish
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Show all captured media URLs
    console.log("\n==============================");
    console.log("Captured media URLs:");
    mediaUrls.forEach((url, idx) => console.log(`${idx + 1}: ${url}`));
    console.log("==============================\n");

    // Save all URLs to facebook_url.txt
    fs.writeFileSync("facebook_url.txt", mediaUrls.join("\n"), "utf-8");
    console.log("[Facebook] Media URLs saved to facebook_url.txt");

    // Browser remains open for inspection
    console.log("[Facebook] Script finished. Browser remains open.");
})();
