const puppeteer = require("puppeteer");
const fs = require("fs");

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function waitForImages(page) {
  console.log("[Instagram] Waiting for <img> tags...");
  while (true) {
    const imgs = await page.$$("img");
    if (imgs.length > 0) {
      console.log(`[Instagram] Found ${imgs.length} <img> tags`);
      return imgs;
    }
    await sleep(1000);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  const url = "https://www.instagram.com/p/DJdy-uwMlcR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==";
  console.log("[Instagram] Opening Instagram post...");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("[Instagram] Page loaded. Waiting for images...");
  await waitForImages(page);

  // Extract only large images (post images) that are visible and have style="object-fit:cover"
  const imgTagsHtml = await page.$$eval("img", imgs =>
    imgs
      .filter(img => {
        const src = img.getAttribute("src") || "";
        const style = img.getAttribute("style") || "";

        // Check visibility
        const computedStyle = window.getComputedStyle(img);
        const isVisible =
          computedStyle &&
          computedStyle.display !== "none" &&
          computedStyle.visibility !== "hidden" &&
          computedStyle.opacity !== "0";

        return src.includes("/v/t39.30808-6/") && style.includes("object-fit:cover") && isVisible;
      })
      .map(img => {
        const attrs = Array.from(img.attributes).map(a => `${a.name}="${a.value}"`).join(" ");
        return `<img ${attrs}>`;
      })
      .join("\n")
  );

  // Save only the filtered <img> tags
  fs.writeFileSync("result.html", imgTagsHtml, "utf-8");
  console.log("[Instagram] Saved filtered <img> tags to result.html");

  await browser.close();
})();
