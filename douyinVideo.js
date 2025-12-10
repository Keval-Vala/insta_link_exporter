const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const DOUYIN_URL = "https://v.douyin.com/i-rPFQb5myg/";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  let videoUrl = null;
  let hlsUrl = null;
  const tsSegments = new Set();

  console.log("[Douyin] Opening Douyin video page...");
  await page.goto(DOUYIN_URL, { waitUntil: "networkidle2" });

  // Listen for all network responses to capture video/audio URLs
  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      // Direct MP4 video
      if (!videoUrl && url.includes("snssdk") && (url.endsWith(".mp4") || contentType.includes("video/mp4"))) {
        videoUrl = url;
        console.log("[Douyin] Found direct video URL:", videoUrl);
      }

      // HLS playlist
      if (!hlsUrl && contentType.includes("application/vnd.apple.mpegurl")) {
        hlsUrl = url;
        console.log("[Douyin] Found HLS playlist URL (.m3u8):", hlsUrl);
      }

      // HLS TS segments
      if (hlsUrl && (url.endsWith(".ts") || contentType.includes("video/MP2T"))) {
        tsSegments.add(url);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Wait for video to load properly
  await new Promise(resolve => setTimeout(resolve, 15000)); // waits 15 seconds


  // Try to get video src directly from the <video> tag (for short videos)
  const videoSrc = await page.evaluate(() => {
    const video = document.querySelector(".leftContainer video");
    if (!video) return null;
    return video.src || (video.querySelector("source") && video.querySelector("source").src);
  });

  if (videoSrc && !videoSrc.startsWith("blob:")) {
    videoUrl = videoSrc;
    console.log("[Douyin] Video src from <video> tag:", videoUrl);
  } else if (videoSrc && videoSrc.startsWith("blob:")) {
    console.log("[Douyin] Video src is a blob URL. Need network interception to download.");
  }

  // Summary
  if (videoUrl) {
    console.log("✅ You can download this short video directly:", videoUrl);
  } else if (hlsUrl) {
    console.log("✅ Long video detected. Use HLS (.m3u8) URL or TS segments to download via FFmpeg or HLS downloader.");
    console.log("HLS URL:", hlsUrl);
    console.log(`Total captured TS segments: ${tsSegments.size}`);
  } else {
    console.log("❌ No video URL captured. Possibly blocked or network interception failed.");
  }

  await browser.close();
})();
