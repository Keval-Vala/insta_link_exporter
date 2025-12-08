const puppeteer = require("puppeteer");
const fs = require("fs");

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Check if the post is a carousel
async function isCarousel(page) {
  return (await page.$('button[aria-label="Next"]')) !== null;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const url = "https://www.instagram.com/p/DJdy-uwMlcR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==";

  console.log("[Instagram] Opening post...");
  await page.goto(url, { waitUntil: "networkidle2" });

  await sleep(2000); // Wait for images to load

  // Close any popup if it appears
  try {
    await page.waitForSelector('div[role="dialog"] svg[aria-label="Close"]', { timeout: 3000 });
    await page.click('div[role="dialog"] svg[aria-label="Close"]');
    console.log("Popup closed.");
  } catch (e) {
    console.log("No popup detected.");
  }

  const carousel = await isCarousel(page);

  if (!carousel) {
    console.log("No carousel detected. Collecting single image(s)...");
  } else {
    console.log("➡️ Carousel detected. Collecting all images...");
  }

  const imageUrls = new Set(); // store unique image URLs

  while (true) {
    // Collect visible images
    const imgs = await page.$$eval(
      'div[role="presentation"] img, div[role="button"] img',
      imgs => imgs.map(img => img.src)
    );

    // Filter out profile pictures
    imgs
      .filter(src => !src.includes("t51.2885-19") && !src.includes("profile_pic"))
      .forEach(src => imageUrls.add(src));

    // Break if not a carousel
    if (!carousel) break;

    // Move to next image in carousel if available
    const nextBtn = await page.$('button[aria-label="Next"]');
    if (!nextBtn) break;

    const isDisabled = await nextBtn.evaluate(btn => btn.disabled);
    if (isDisabled) break;

    await nextBtn.click();
    await sleep(1000);
  }

  if (imageUrls.size > 0) {
    // Save as plain text
    fs.writeFileSync("image.txt", Array.from(imageUrls).join("\n"), "utf-8");

    // Save as HTML
    const html = Array.from(imageUrls)
      .map(src => `<img src="${src}">`)
      .join("\n");
    fs.writeFileSync("result_multiple.html", html, "utf-8");

    console.log(`✅ Saved ${imageUrls.size} image(s). Check image.txt & result_multiple.html`);
  } else {
    console.log("No images (excluding profile pics) found.");
  }

  await browser.close();
})();
