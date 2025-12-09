const puppeteer = require("puppeteer");
const { exec } = require("child_process");

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

async function waitForVideo(page) {
  console.log("[YouTube] Waiting for <video> tag...");
  while (true) {
    const video = await safeQuery(page, "video");
    if (video) {
      console.log("[YouTube] VIDEO FOUND!");
      return video;
    }
    await sleep(500);
  }
}

function extractQualityFromUrl(url) {
  // YouTube uses itag parameter to identify quality
  const itagMatch = url.match(/[&?]itag=(\d+)/);
  if (!itagMatch) return "unknown";
  
  const itag = itagMatch[1];
  
  // Common YouTube itag quality mappings
  const qualityMap = {
    // Video + Audio (legacy formats)
    "22": "720p",
    "18": "360p",
    
    // Video only (DASH)
    "137": "1080p",
    "136": "720p",
    "135": "480p",
    "134": "360p",
    "133": "240p",
    "160": "144p",
    
    // Higher quality
    "248": "1080p",
    "247": "720p",
    "244": "480p",
    "243": "360p",
    "242": "240p",
    "278": "144p",
    
    // 2K/4K
    "271": "1440p",
    "313": "2160p",
    "401": "2160p",
    
    // Audio only
    "140": "AUDIO",
    "251": "AUDIO",
    "250": "AUDIO",
    "249": "AUDIO",
  };
  
  return qualityMap[itag] || `itag${itag}`;
}

function analyzeMediaUrl(url, contentType) {
  const quality = extractQualityFromUrl(url);
  
  // Check if it's audio
  if (quality === "AUDIO" || contentType.includes("audio")) {
    return { type: "AUDIO ONLY", quality: "N/A" };
  }
  
  // Check mime type for video/audio
  if (url.includes("mime=video") || contentType.includes("video")) {
    return { type: "VIDEO ONLY", quality };
  }
  
  if (url.includes("mime=audio") || contentType.includes("audio")) {
    return { type: "AUDIO ONLY", quality: "N/A" };
  }
  
  return { type: "UNKNOWN", quality };
}

function mergeVideoAudio(videoUrl, audioUrl, quality, callback) {
  const outputFile = `youtube_${quality}.mp4`;
  
  const cmd = `ffmpeg -y -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac "${outputFile}"`;
  
  exec(cmd, (err) => {
    if (err) {
      console.error(`[FFmpeg] Error merging ${quality}:`, err.message);
      callback(false);
      return;
    }
    console.log(`[FFmpeg] ✓ Saved: ${outputFile}`);
    callback(true);
  });
}

(async () => {
  const videoUrls = new Map();
  let audioUrl = null;

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();

  // Override autoplay policy
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      get: () => ({
        getUserMedia: () => Promise.resolve({}),
      }),
    });
  });

  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    // YouTube video URLs contain videoplayback
    if (!url.includes("videoplayback")) return;
    
    const info = analyzeMediaUrl(url, contentType);

    if (info.type === "AUDIO ONLY" && !audioUrl) {
      audioUrl = url;
      console.log(`\n[AUDIO FOUND]\n${url.substring(0, 100)}...`);
      return;
    }

    if (info.type === "VIDEO ONLY") {
      if (!videoUrls.has(info.quality)) {
        videoUrls.set(info.quality, url);
        console.log(`\n[VIDEO FOUND - ${info.quality}]\n${url.substring(0, 100)}...`);
      }
    }
  });

  // Replace with your YouTube video URL
  const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  console.log("[YouTube] Opening video page...");
  await page.goto(url, { waitUntil: "networkidle0" });

  await waitForVideo(page);

  // Auto-play the video and trigger quality changes
  console.log("[YouTube] Auto-playing video and loading qualities...");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      video.muted = false;
      video.volume = 0.5;
      video.play().catch(() => {});
    }
  });

  // Wait for initial playback
  await sleep(3000);

  // Try to trigger different quality loads by changing quality settings
  console.log("[YouTube] Attempting to load multiple qualities...");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      // Seek to trigger more chunks
      video.currentTime = 10;
      video.play().catch(() => {});
    }
  });

  await sleep(2000);

  // Try to access quality menu (YouTube specific)
  await page.evaluate(() => {
    const settingsButton = document.querySelector('.ytp-settings-button');
    if (settingsButton) settingsButton.click();
  }).catch(() => {});

  await sleep(1000);

  await page.evaluate(() => {
    const qualityMenu = document.querySelector('.ytp-quality-menu');
    if (qualityMenu) qualityMenu.click();
  }).catch(() => {});

  // Wait to capture all qualities during playback
  console.log("[YouTube] Waiting for all qualities to load...");
  await sleep(15000);

  await browser.close();

  console.log("\n========== FINAL RESULTS ==========");
  console.log("Audio:", audioUrl ? "✔ Found" : "✘ Missing");

  console.log("Video Qualities Found:");
  console.log([...videoUrls.keys()].join(", ") || "None");
  console.log("==================================\n");

  if (!audioUrl || videoUrls.size === 0) {
    console.log("[ERROR] Missing video or audio. Cannot merge.");
    console.log("\nTip: YouTube may use adaptive streaming. Try playing the video longer or at different qualities.");
    return;
  }

  console.log("[YouTube] Starting merge tasks...");

  let completed = 0;
  const total = videoUrls.size;

  videoUrls.forEach((videoUrl, quality) => {
    mergeVideoAudio(videoUrl, audioUrl, quality, () => {
      completed++;
      if (completed === total) console.log("\nALL MERGES COMPLETE!");
    });
  });

})();