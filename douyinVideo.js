const puppeteer = require("puppeteer");
const { exec } = require("child_process");

const DOUYIN_URL = "https://v.douyin.com/JjJOL1TURKc/";

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  let videoUrl = null;
  let audioUrl = null;

  // Monitor network responses for video/audio URLs (optional, for better capture)
  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (!videoUrl && url.includes("snssdk") && (url.endsWith(".mp4") || contentType.includes("video"))) {
        videoUrl = url;
        console.log("[Douyin] Found video URL from network:", videoUrl);
      }

      if (!audioUrl && url.includes("snssdk") && (contentType.includes("audio") || url.endsWith(".m4a") || url.endsWith(".aac"))) {
        audioUrl = url;
        console.log("[Douyin] Found audio URL from network:", audioUrl);
      }
    } catch (err) {
      console.error(err);
    }
  });

  console.log("[Douyin] Opening Douyin video page...");
  await page.goto(DOUYIN_URL, { waitUntil: "networkidle2" });

  // Wait a few seconds for page elements to load
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Check if .leftContainer exists and has a <video> tag
  const hasVideoTag = await page.evaluate(() => {
    const container = document.querySelector(".leftContainer");
    if (!container) return false;
    return container.querySelector("video") !== null;
  });

  if (!hasVideoTag) {
    console.log("❌ No video found inside .leftContainer");
    await browser.close();
    return;
  }

  console.log("✅ Video tag found inside .leftContainer");

  // Get video src directly from the <video> tag
  const videoSrc = await page.evaluate(() => {
    const video = document.querySelector(".leftContainer video");
    if (!video) return null;
    return video.src || (video.querySelector("source") && video.querySelector("source").src);
  });

  if (videoSrc) {
    console.log("[Douyin] Video src from <video> tag:", videoSrc);
    videoUrl = videoSrc; // Use this as main video URL
  } else {
    console.log("[Douyin] Could not get video src from <video> tag, falling back to network interception.");
  }

  // Use FFmpeg to merge video + audio if available
  if (videoUrl) {
    let ffmpegCommand = "";

    if (audioUrl) {
      ffmpegCommand = `ffmpeg -y -i "${videoUrl}" -i "${audioUrl}" -c copy output.mp4`;
      console.log("[FFmpeg] Merging video and audio...");
    } else {
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
    console.log("[Douyin] Video URL not captured!");
  }

  await browser.close();
})();
