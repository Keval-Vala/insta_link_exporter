const fs = require("fs");
const https = require("https");
const puppeteer = require("puppeteer");
const path = require("path");

// -------------------------
// Safe query wrapper
// -------------------------
async function safeQuery(page, selector) {
  try {
    return await page.$(selector);
  } catch (e) {
    return null;
  }
}

// -------------------------
// Sleep helper
// -------------------------
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// -------------------------
// Wait for video tag to appear
// -------------------------
async function waitForVideo(page) {
  console.log("[Instagram] Waiting for <video> tag...");

  while (true) {
    const video = await safeQuery(page, "video");
    if (video) {
      console.log("[Instagram] VIDEO FOUND!");
      return video;
    }
    await sleep(1000);
  }
}

// -------------------------
// Download complete video
// -------------------------
function downloadCompleteVideo(url) {
  return new Promise((resolve, reject) => {
    // Remove byte range parameters to get the complete video
    const cleanUrl = url.split('&bytestart=')[0];
    console.log(`[Instagram] Found video URL: ${cleanUrl}`);
    
    console.log(`[Instagram] Video URL would be downloaded here, but file saving is disabled`);
    resolve();
  });
}

// -------------------------
// MAIN
// -------------------------
(async () => {
  let videoFound = false; // FLAG TO CLOSE BROWSER ONCE DONE

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Capture network requests for .mp4 or media files
  page.on("response", async (response) => {
    if (videoFound) return; // already handled
    
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    if (contentType.includes("video/mp4")) {
      console.log("[Instagram] VIDEO URL FOUND:");

      videoFound = true;

      try {
        await downloadCompleteVideo(url);
      } catch (err) {
        console.error("[Instagram] Error with video:", err.message);
      } finally {
        console.log("[Instagram] Video processing complete. Closing browser...");
        await browser.close();
      }
    }
  });

  const url = "https://www.instagram.com/reel/DRSKOoujopt/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";

  console.log("[Instagram] Opening reel page...");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("[Instagram] Page loaded. Detecting video...");

  const video = await waitForVideo(page);

  // Fallback: If video not detected in network after 10s, close browser
  setTimeout(async () => {
    if (!videoFound) {
      console.log("[Instagram] Timeout: No video URL captured. Closing browser...");
      await browser.close();
    }
  }, 10000);
})();