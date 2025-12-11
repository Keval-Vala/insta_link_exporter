const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  let videoUrl = null;
  let audioUrl = null;

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      // Capture main video (HLS or mp4)
      if (!videoUrl && url.includes("pinimg.com") && (url.endsWith(".mp4") || contentType.includes("video"))) {
        videoUrl = url;
        console.log("[Pinterest] Found video URL:", videoUrl);
      }

      // Capture audio (m4a, aac, or audio track)
      if (!audioUrl && url.includes("pinimg.com") && (contentType.includes("audio") || url.endsWith(".m4a") || url.endsWith(".aac"))) {
        audioUrl = url;
        console.log("[Pinterest] Found audio URL:", audioUrl);
      }

    } catch (err) {
      console.error(err);
    }
  });

  const pinUrl = "https://pin.it/1YXwaexhM";
  console.log("[Pinterest] Opening Pinterest pin and monitoring network requests for 60s...");
  await page.goto(pinUrl, { waitUntil: "networkidle2" });

  // Wait 60 seconds to capture video/audio requests
  await new Promise(res => setTimeout(res, 60000));

  if (videoUrl) {
    let ffmpegCommand = "";

    if (audioUrl) {
      // Merge video + audio into one MP4
      ffmpegCommand = `ffmpeg -y -i "${videoUrl}" -i "${audioUrl}" -c copy output.mp4`;
      console.log("[FFmpeg] Merging video and audio...");
    } else {
      // Only video available
      ffmpegCommand = `ffmpeg -y -i "${videoUrl}" -c copy output.mp4`;
      console.log("[FFmpeg] Only video found, saving as MP4...");
    }

    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`FFmpeg error: ${error.message}`);
        return;
      }
      console.log("[FFmpeg] Video saved as output.mp4");
    });

  } else {
    console.log("[Pinterest] No video URL found!");
  }

  await browser.close();
})();
