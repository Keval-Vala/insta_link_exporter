const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    const page = await browser.newPage();

    const url = "https://www.instagram.com/p/DJdy-uwMlcR/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";
    console.log("[Instagram] Opening Instagram post...");
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for the page to load at least some content
    await page.waitForSelector("body");

    // Get all images inside div[role="button"]
    const imageSrcs = await page.$$eval('div[role="button"]', divs => {
        return divs.flatMap(div => {
            const imgs = Array.from(div.querySelectorAll('img'));
            return imgs.map(img => img.src);
        });
    });

    // Filter out profile pictures
    const filteredSrcs = imageSrcs.filter(src => {
        return !src.includes("t51.2885-19") && !src.includes("profile_pic");
    });

    if (filteredSrcs.length > 0) {
        fs.writeFileSync("image.txt", filteredSrcs.join("\n"), "utf-8");
        console.log(`Saved ${filteredSrcs.length} image src(s) (excluding profile pics) into image.txt`);
    } else {
        console.log("No images (excluding profile pics) found.");
    }

    await browser.close();
})();
