const puppeteer = require("puppeteer");
const fs = require("fs");

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function isCarousel(page) {
  return (await page.$('button[aria-label="Next"]')) !== null;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const url = "https://www.instagram.com/p/DPydrzyE8ZR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==";

  console.log("[Instagram] Opening post...");
  await page.goto(url, { waitUntil: "networkidle2" });

  await sleep(2000); // Wait for images to load

  try {
    await page.waitForSelector('div[role="dialog"] svg[aria-label="Close"]', { timeout: 3000 });
    await page.click('div[role="dialog"] svg[aria-label="Close"]');
    console.log("Popup closed.");
  } catch (e) {
    console.log("No popup detected.");
  }

  const carousel = await isCarousel(page);

  if (!carousel) {
    console.log("🖼️ Single image detected");

    const html = await page.$$eval("div[role='presentation'] img", imgs =>
      imgs
        .map(img => {
          const attrs = Array.from(img.attributes)
            .map(a => `${a.name}="${a.value}"`)
            .join(" ");
          return `<img ${attrs}>`;
        })
        .join("\n")
    );

    fs.writeFileSync("result_single.html", html, "utf-8");
    console.log("Saved result_single.html");
    await browser.close();
    return;
  }

  console.log("➡️ Carousel detected. Collecting all images...");

  const imageUrls = new Set(); // unique URLs

  while (true) {
    // Get current visible carousel image(s)
    const imgs = await page.$$eval(
      'div[role="presentation"] img',
      imgs => imgs.map(img => img.src)
    );

    imgs.forEach(src => imageUrls.add(src));

    // Check if Next button exists
    const nextBtn = await page.$('button[aria-label="Next"]');
    if (!nextBtn) break;

    // Check if Next button is disabled (last slide)
    const isDisabled = await nextBtn.evaluate(btn => btn.disabled);
    if (isDisabled) break;

    await nextBtn.click();
    await sleep(1000); // wait for next image to load
  }

  // Convert URLs to <img> tags
  const html = Array.from(imageUrls)
    .map(src => `<img src="${src}">`)
    .join("\n");

  fs.writeFileSync("result_multiple.html", html, "utf-8");
  console.log(`✅ Saved ${imageUrls.size} images to result_multiple.html`);

  await browser.close();
})();


