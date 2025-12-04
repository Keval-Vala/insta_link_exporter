const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");
const http = require("http");

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  let gifUrl = null;
  let videoGifUrl = null; // Pinterest often serves GIFs as MP4/WebM

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      // Capture actual GIF files
      if (!gifUrl && url.includes("pinimg.com") && 
          (url.endsWith(".gif") || contentType.includes("image/gif"))) {
        gifUrl = url;
        console.log("[Pinterest] Found GIF URL:", gifUrl);
      }

      // Pinterest often serves GIFs as video (MP4/WebM) - look for originals
      if (!videoGifUrl && url.includes("pinimg.com") && 
          (url.includes("originals") || url.includes("/750x/")) &&
          (url.endsWith(".mp4") || url.endsWith(".webm") || 
           contentType.includes("video"))) {
        videoGifUrl = url;
        console.log("[Pinterest] Found Video-GIF URL:", videoGifUrl);
      }

    } catch (err) {
      console.error(err);
    }
  });

  const pinUrl = "https://pin.it/7ag5a9vZU"; // Replace with your GIF pin URL
  console.log("[Pinterest] Opening Pinterest pin and monitoring network requests...");
  
  await page.goto(pinUrl, { waitUntil: "networkidle2" });

  // Scroll to trigger lazy loading
  await page.evaluate(() => {
    window.scrollBy(0, 500);
  });

  // Wait for GIF to load
  await new Promise(res => setTimeout(res, 10000));

  // Try to extract GIF URL from page if not captured via network
  if (!gifUrl && !videoGifUrl) {
    const extractedUrl = await page.evaluate(() => {
      // Look for video elements (Pinterest renders GIFs as videos)
      const video = document.querySelector('video source');
      if (video) return video.src;

      const videoEl = document.querySelector('video');
      if (videoEl && videoEl.src) return videoEl.src;

      // Look for GIF images
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (img.src && img.src.includes('.gif')) {
          return img.src;
        }
      }

      return null;
    });

    if (extractedUrl) {
      if (extractedUrl.endsWith('.gif')) {
        gifUrl = extractedUrl;
      } else {
        videoGifUrl = extractedUrl;
      }
      console.log("[Pinterest] Extracted URL from page:", extractedUrl);
    }
  }

  // Download the GIF/Video
  const downloadUrl = gifUrl || videoGifUrl;
  
  if (downloadUrl) {
    const extension = downloadUrl.includes('.gif') ? 'gif' : 
                      downloadUrl.includes('.webm') ? 'webm' : 'mp4';
    const outputFile = `pinterest_gif.${extension}`;

    console.log(`[Pinterest] Downloading ${extension.toUpperCase()}...`);

    await downloadFile(downloadUrl, outputFile);
    console.log(`[Pinterest] Saved as ${outputFile}`);

  } else {
    console.log("[Pinterest] No GIF URL found!");
  }

  await browser.close();
})();

// Helper function to download file
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(filename);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, filename)
          .then(resolve)
          .catch(reject);
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(filename, () => {}); // Delete partial file
      reject(err);
    });
  });
}