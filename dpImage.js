const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");

// Universal delay function
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const file = fs.createWriteStream(filepath);
            res.pipe(file);
            file.on("finish", () => file.close(resolve));
        }).on("error", reject);
    });
}

(async () => {

    const inputUrl = "https://www.instagram.com/pixabay/";

    const username = inputUrl
        .replace("https://www.instagram.com/", "")
        .replace("/", "")
        .trim();

    if (!username) {
        console.log("Could not extract username from URL.");
        return;
    }

    console.log("Extracted username:", username);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    const page = await browser.newPage();
    const finalUrl = `https://www.instagram.com/${username}/`;

    console.log(`[Instagram] Opening profile: ${finalUrl}`);

    await page.goto(finalUrl, { waitUntil: "networkidle2" });

    // Replace failing waitForTimeout with delay()
    await delay(2500);

    const profilePic = await page.evaluate(() => {
        const img = document.querySelector("header img");
        return img ? img.src : null;
    });

    if (!profilePic) {
        console.log("Could not locate profile picture.");
        await browser.close();
        return;
    }

    console.log("Profile DP URL:", profilePic);

    const filePath = `${username}_profile_dp.jpg`;
    await downloadImage(profilePic, filePath);

    console.log(`Downloaded profile DP as: ${filePath}`);

    await browser.close();
})();
