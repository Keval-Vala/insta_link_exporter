const fs = require("fs");
const https = require("https");
const puppeteer = require("puppeteer");
const path = require("path");

async function safeQuery(page, selector) {
  try {
    return await page.$(selector);
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function waitForStoryMedia(page) {
  console.log("[Instagram Stories] Waiting for story media...");

  while (true) {
    const video = await safeQuery(page, 'video source, video');
    if (video) {
      console.log("[Instagram Stories] VIDEO STORY FOUND!");
      return { type: 'video', element: video };
    }

    const image = await safeQuery(page, 'img[srcset], section img[decoding="auto"]');
    if (image) {
      console.log("[Instagram Stories] IMAGE STORY FOUND!");
      return { type: 'image', element: image };
    }

    await sleep(1000);
  }
}

function cleanUrl(url) {
  const u = new URL(url);

  // remove byte-range params ONLY
  u.searchParams.delete("bytestart");
  u.searchParams.delete("byteend");

  return u.href;
}

function downloadMedia(url, filename) {
  return new Promise((resolve) => {
    const clean = cleanUrl(url); // CLEAN URL
    console.log(`[Instagram Stories] Found media URL: ${clean.substring(0, 100)}...`);
    console.log(`[Instagram Stories] Media URL captured (download disabled)`);
    resolve();
  });
}

async function clickNextStory(page) {
  try {
    const nextButton = await page.$('button[aria-label="Next"]');
    if (nextButton) {
      await nextButton.click();
      console.log("[Instagram Stories] Clicked next story");
      return true;
    }

    const storyContainer = await page.$('section[role="presentation"]');
    if (storyContainer) {
      const box = await storyContainer.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
        console.log("[Instagram Stories] Clicked right side for next story");
        return true;
      }
    }

    return false;
  } catch (e) {
    console.log("[Instagram Stories] Could not navigate to next story");
    return false;
  }
}

(async () => {
  const capturedUrls = new Set();
  let storyCount = 0;
  const maxStories = 10;

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    // VIDEO
    if (contentType.includes("video/mp4") && !capturedUrls.has(url)) {
      const clean = cleanUrl(url); // CLEAN URL
      console.log("[Instagram Stories] VIDEO URL CAPTURED!");

      capturedUrls.add(clean);
      storyCount++;

      try {
        await downloadMedia(clean, `story_video_${storyCount}.mp4`);
      } catch (err) {
        console.error("[Instagram Stories] Error:", err.message);
      }
    }

    // IMAGE (excluding profile pictures)
    if (
      (contentType.includes("image/jpeg") || contentType.includes("image/webp")) &&
      url.includes("instagram") &&
      url.includes("dst-jpg") &&
      !url.includes("s150x150") &&  // <-- ignore profile pictures
      !url.includes("profile")      // <-- extra filter
    ) {
      const clean = cleanUrl(url); // CLEAN URL
      if (!capturedUrls.has(clean)) {
        console.log("[Instagram Stories] IMAGE URL CAPTURED!");
        capturedUrls.add(clean);
      }
    }
  });

  const storyUrl = "https://www.instagram.com/stories/pixabay/";

  console.log("[Instagram Stories] Opening story page...");

  try {
    await page.goto(storyUrl, {
      waitUntil: "networkidle2",
      timeout: 30000
    });
  } catch (e) {
    console.log("[Instagram Stories] Page load timeout, continuing...");
  }

  console.log("[Instagram Stories] Page loaded. Detecting stories...");

  await waitForStoryMedia(page);

  await sleep(3000);

  console.log("[Instagram Stories] Attempting to capture multiple stories...");

  for (let i = 0; i < maxStories - 1; i++) {
    await sleep(2000);
    const hasNext = await clickNextStory(page);
    if (!hasNext) {
      console.log("[Instagram Stories] No more stories available");
      break;
    }
    await sleep(2000);
  }

  await sleep(3000);

  // SAVE CLEANED URLS
  console.log("[Instagram Stories] Saving cleaned URLs to stories.txt...");
  fs.writeFileSync(
    "stories.txt",
    Array.from(capturedUrls).join("\n"),
    "utf-8"
  );

  console.log(`[Instagram Stories] Capture complete. Saved ${capturedUrls.size} cleaned URLs to stories.txt`);

  console.log("[Instagram Stories] Closing browser...");
  await browser.close();

})();
