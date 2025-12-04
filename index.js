const puppeteer = require("puppeteer");
const { exec } = require("child_process");
const fs = require("fs");

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

function decodeEfgParameter(url) {
  try {
    const efgMatch = url.match(/efg=([^&]+)/);
    if (!efgMatch) return null;
    
    const efgEncoded = decodeURIComponent(efgMatch[1]);
    const efgDecoded = Buffer.from(efgEncoded, 'base64').toString('utf-8');
    return JSON.parse(efgDecoded);
  } catch (e) {
    return null;
  }
}

function analyzeMediaUrl(url, contentType) {
  const efgData = decodeEfgParameter(url);
  
  let quality = "unknown";
  
  if (efgData && efgData.vencode_tag) {
    const tag = efgData.vencode_tag.toLowerCase();
    
    // Extract quality from tag
    const qualityMatch = tag.match(/(\d+)p/);
    if (qualityMatch) {
      quality = qualityMatch[1] + "p";
    }
    
    // DASH streams separate audio and video
    if (tag.includes('_audio') || (tag.includes('heaac') && !qualityMatch)) {
      return { type: "AUDIO ONLY", quality: "N/A", efgTag: efgData.vencode_tag };
    }
    
    if (qualityMatch && (tag.includes('vp9') || tag.includes('dash'))) {
      return { type: "VIDEO ONLY", quality, efgTag: efgData.vencode_tag };
    }
    
    if (qualityMatch && tag.includes('audio')) {
      return { type: "VIDEO + AUDIO", quality, efgTag: efgData.vencode_tag };
    }
  }
  
  // Fallback to content-type
  if (contentType.includes("video")) {
    return { type: "VIDEO (Unknown)", quality, efgTag: null };
  } else if (contentType.includes("audio")) {
    return { type: "AUDIO ONLY", quality: "N/A", efgTag: null };
  }
  
  return { type: "UNKNOWN", quality, efgTag: null };
}

function mergeVideoAudio(videoUrl, audioUrl, quality, callback) {
  const outputFile = `output_video_${quality}.mp4`;
  
  console.log(`\n[FFmpeg] Merging ${quality} video with audio...`);
  console.log(`[FFmpeg] Video: ${videoUrl.substring(0, 80)}...`);
  console.log(`[FFmpeg] Audio: ${audioUrl.substring(0, 80)}...`);
  
  const ffmpegCommand = `ffmpeg -y -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac "${outputFile}"`;
  
  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`[FFmpeg] Error merging ${quality}: ${error.message}`);
      callback(false);
      return;
    }
    console.log(`[FFmpeg] ✓ Successfully saved: ${outputFile}`);
    callback(true);
  });
}

(async () => {
  const videoUrls = new Map(); // Store video-only URLs by quality
  let audioUrl = null;
  let foundMedia = false;

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Capture network requests
  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    const isVideo = contentType.includes("video/mp4");
    const isAudio = contentType.includes("audio/mp4") || 
                    contentType.includes("audio/mpeg") ||
                    contentType.includes("audio/aac") ||
                    contentType.includes("audio/x-m4a");

    if (isVideo || isAudio) {
      const baseUrl = url.split('?')[0];
      const mediaInfo = analyzeMediaUrl(url, contentType);
      const cleanUrl = url.split('&bytestart=')[0];
      
      if (mediaInfo.type === "AUDIO ONLY" && !audioUrl) {
        audioUrl = cleanUrl;
        console.log(`\n[Instagram] AUDIO FOUND:`);
        console.log(`  URL: ${cleanUrl.substring(0, 100)}...`);
        foundMedia = true;
      } 
      else if (mediaInfo.type === "VIDEO ONLY" && !videoUrls.has(mediaInfo.quality)) {
        videoUrls.set(mediaInfo.quality, cleanUrl);
        console.log(`\n[Instagram] VIDEO FOUND (${mediaInfo.quality}):`);
        console.log(`  URL: ${cleanUrl.substring(0, 100)}...`);
        foundMedia = true;
      }
    }
  });

  const url = "https://www.instagram.com/reel/DRSKOoujopt/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";

  console.log("[Instagram] Opening reel page...");
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("[Instagram] Page loaded. Detecting media...");
  await waitForVideo(page);

  // Wait for all media to load
  await sleep(10000);

  console.log("\n========================================");
  console.log("CAPTURE SUMMARY:");
  console.log(`  Audio URLs: ${audioUrl ? 1 : 0}`);
  console.log(`  Video URLs: ${videoUrls.size}`);
  console.log("========================================\n");

  await browser.close();

  // Merge videos with audio using FFmpeg
  if (audioUrl && videoUrls.size > 0) {
    console.log("[Instagram] Starting FFmpeg merge operations...\n");
    
    let completed = 0;
    const total = videoUrls.size;

    videoUrls.forEach((videoUrl, quality) => {
      mergeVideoAudio(videoUrl, audioUrl, quality, (success) => {
        completed++;
        if (completed === total) {
          console.log("\n========================================");
          console.log("ALL MERGES COMPLETE!");
          console.log(`Created ${total} output file(s)`);
          console.log("========================================");
        }
      });
    });

  } else if (videoUrls.size > 0 && !audioUrl) {
    console.log("[Instagram] Warning: Found video but no audio. Videos will have no sound.");
  } else {
    console.log("[Instagram] Error: No media files captured!");
  }

})();