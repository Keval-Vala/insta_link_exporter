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
  console.log("[Facebook] Waiting for <video> tag...");
  while (true) {
    const video = await safeQuery(page, "video");
    if (video) {
      console.log("[Facebook] VIDEO FOUND!");
      return video;
    }
    await sleep(500);
  }
}

// New decodeEfgParameter function
function decodeEfgParameter(url) {
  try {
    const efgMatch = url.match(/efg=([^&]+)/);
    if (!efgMatch) return null;
    const decoded = Buffer.from(decodeURIComponent(efgMatch[1]), "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Updated analyzeMediaUrl
function analyzeMediaUrl(url, contentType) {
  const efg = decodeEfgParameter(url);
  let quality = "unknown";

  if (efg && efg.vencode_tag) {
    const tag = efg.vencode_tag.toLowerCase();
    const qmatch = tag.match(/(\d{3,4})p/);
    if (qmatch) quality = qmatch[1] + "p";

    if (tag.includes("audio")) return { type: "AUDIO ONLY", quality: "N/A" };
    return { type: "VIDEO ONLY", quality };
  }

  // fallback
  if (contentType.includes("video")) return { type: "VIDEO ONLY", quality };
  if (contentType.includes("audio")) return { type: "AUDIO ONLY", quality: "N/A" };

  return { type: "UNKNOWN", quality };
}

function mergeVideoAudio(videoUrl, audioUrl, quality, callback) {
  const outputFile = `fb_output_video.mp4`;

  const cmd = `ffmpeg -y -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac "${outputFile}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(`[FFmpeg] Error merging:`, err.message);
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
  });

  const page = await browser.newPage();

  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    if (!contentType.includes("video") && !contentType.includes("audio")) return;

    const cleanUrl = url.split("&bytestart=")[0];
    const info = analyzeMediaUrl(url, contentType);

    if (info.type === "AUDIO ONLY" && !audioUrl) {
      audioUrl = cleanUrl;
      console.log(`\n[AUDIO FOUND]\n${cleanUrl}`);
      return;
    }

    if (info.type === "VIDEO ONLY") {
      if (!videoUrls.has(info.quality)) {
        videoUrls.set(info.quality, cleanUrl);
        console.log(`\n[VIDEO FOUND - ${info.quality}]\n${cleanUrl}`);
      }
    }
  });

  const url = "https://www.facebook.com/share/r/17KVF5DhkS/"; // Replace REEL_ID with actual reel ID

  console.log("[Facebook] Opening reel page...");
  await page.goto(url, { waitUntil: "networkidle2" });

  await waitForVideo(page);

  // Trigger video playback to load different DASH qualities
  console.log("[Facebook] Triggering video playback to load all qualities...");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      video.muted = true;
      video.play().catch(() => {});
      video.scrollIntoView();
      video.pause();
      video.play().catch(() => {});
    }
  });

  // Wait & catch all qualities
  console.log("[Facebook] Waiting for all qualities to load...");
  await sleep(15000);

  await browser.close();

  console.log("\n========== FINAL RESULTS ==========");
  console.log("Audio:", audioUrl ? "✔ Found" : "✘ Missing");

  console.log("Video Qualities Found:");
  console.log([...videoUrls.keys()].join(", ") || "None");
  console.log("==================================\n");

  if (!audioUrl || videoUrls.size === 0) {
    console.log("[ERROR] Missing video or audio. Cannot merge.");
    return;
  }

  console.log("[Facebook] Starting merge tasks...");

  let completed = 0;
  const total = videoUrls.size;

  videoUrls.forEach((videoUrl, quality) => {
    mergeVideoAudio(videoUrl, audioUrl, quality, () => {
      completed++;
      if (completed === total) console.log("\nALL MERGES COMPLETE!");
    });
  });
})();
