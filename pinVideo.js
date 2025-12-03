const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const urls = new Set();

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      // Capture video URLs
      if (url.includes("pinimg.com") && (url.endsWith(".mp4") || contentType.includes("video/mp4"))) {
        urls.add(url);
        console.log("[Pinterest] Found video URL:", url);
      }

      // Capture audio URLs
      if (url.includes("pinimg.com") && (contentType.includes("audio") || url.endsWith(".m4a") || url.endsWith(".aac"))) {
        urls.add(url);
        console.log("[Pinterest] Found audio URL:", url);
      }

      // Capture HLS playlists (may contain audio)
      if (url.includes("pinimg.com") && contentType.includes("application/vnd.apple.mpegurl")) {
        urls.add(url);
        console.log("[Pinterest] Found HLS playlist URL (video/audio):", url);
      }

    } catch (err) {
      console.error(err);
    }
  });

  const pinUrl = "https://pin.it/qzGTTWbqH";
  console.log("[Pinterest] Opening Pinterest pin and monitoring network requests for 60s...");
  await page.goto(pinUrl, { waitUntil: "networkidle2" });

  // Keep the page open for 60 seconds to capture all network requests
  await new Promise(res => setTimeout(res, 60000));

  const uniqueUrls = Array.from(urls);
  if (uniqueUrls.length > 0) {
    fs.writeFileSync("pinterest_video_audio_urls.txt", uniqueUrls.join("\n"), "utf-8");
    console.log("[Pinterest] Saved all detected video/audio URLs to pinterest_video_audio_urls.txt");
  } else {
    console.log("[Pinterest] No video/audio URLs found!");
  }

  await browser.close();
})();
