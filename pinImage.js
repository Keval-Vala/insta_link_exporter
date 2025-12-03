const puppeteer = require("puppeteer");
const fs = require("fs");

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function waitForImages(page) {
  console.log("[Pinterest] Waiting for <img> tags...");
  while (true) {
    const imgs = await page.$$("img");
    if (imgs.length > 0) {
      console.log(`[Pinterest] Found ${imgs.length} <img> tags`);
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

  const url = "https://pin.it/2ivEfBtyY";
  console.log("[Pinterest] Opening Pinterest pin...");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("[Pinterest] Page loaded. Waiting for images...");
  await waitForImages(page);

  // Extract only the main pin image
  const mainImgHtml = await page.$$eval("img", imgs =>
    imgs
      .filter(img => {
        const src = img.getAttribute("src") || "";
        const elementTiming = img.getAttribute("elementtiming") || "";
        const fetchpriority = img.getAttribute("fetchpriority") || "";

        // Filter for main pin image
        return src.includes("pinimg") && elementTiming === "closeupImage" && fetchpriority === "high";
      })
      .map(img => {
        // Convert the <img> element back to HTML string
        const attrs = Array.from(img.attributes)
          .map(a => `${a.name}="${a.value}"`)
          .join(" ");
        return `<img ${attrs}>`;
      })
      .join("\n")
  );

  if (mainImgHtml) {
    fs.writeFileSync("pinterest_main_image.html", mainImgHtml, "utf-8");
    console.log("[Pinterest] Saved main pin image to pinterest_main_image.html");
  } else {
    console.log("[Pinterest] Main pin image not found!");
  }

  await browser.close();
})();
