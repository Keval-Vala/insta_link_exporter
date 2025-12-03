const fs = require("fs");                     
const https = require("https");               
const puppeteer = require("puppeteer");       
const path = require("path");                 


async function safeQuery(page, selector) {    // Define safeQuery to avoid crashing if querySelector fails
  try {
    return await page.$(selector);            // Attempt to select the DOM element using Puppeteer's page.$
  } catch (e) {
    return null;                              // Return null if any error occurs
  }
}

function sleep(ms) {                          // Define a sleep function to pause execution
  return new Promise(res => setTimeout(res, ms)); // Return a promise that resolves after given milliseconds
}


async function waitForVideo(page) {           // Function to wait until a <video> tag appears in the page
  console.log("[Instagram] Waiting for <video> tag..."); // Log waiting status

  while (true) {                              // Loop indefinitely until video is found
    const video = await safeQuery(page, "video"); // Try selecting video element safely
    if (video) {                              // If video element is found
      console.log("[Instagram] VIDEO FOUND!"); // Log success
      return video;                           // Return the found video element
    }
    await sleep(1000);                        // Wait 1 second before checking again
  }
}


function downloadCompleteVideo(url) {         // Function to work with the found video URL
  return new Promise((resolve, reject) => {   // Return a promise for async handling
    const cleanUrl = url.split('&bytestart=')[0]; // Remove byte range parameter from the URL
    console.log(`[Instagram] Found video URL: ${cleanUrl}`); // Log clean video URL
    
    console.log(`[Instagram] Video URL would be downloaded here, but file saving is disabled`); // Log that downloading is disabled
    resolve();                                // Resolve since no actual download is happening
  });
}


(async () => {                                // Start an immediately-invoked async function (main program)
  let videoFound = false;                     // Flag to track if video is already detected to avoid duplicate handling

  const browser = await puppeteer.launch({    // Launch Puppeteer browser instance
    headless: false,                          // Run in non-headless mode to show the browser window
    defaultViewport: null,                    // Use full available viewport instead of default
  });

  const page = await browser.newPage();       // Open a new browser tab

  // Capture network requests for .mp4 or media files
  page.on("response", async (response) => {   // Listen for each network response
    if (videoFound) return;                   // If video already processed, ignore further responses
    
    const url = response.url();               // Get URL of the response
    const contentType = response.headers()["content-type"] || ""; // Get content-type header or empty string

    if (contentType.includes("video/mp4")) {  // If the response is an MP4 video file
      console.log("[Instagram] VIDEO URL FOUND:"); // Log video found

      videoFound = true;                      // Update flag to stop duplicate processing

      try {
        await downloadCompleteVideo(url);     // Attempt to process the video URL
      } catch (err) {                         // Catch any errors
        console.error("[Instagram] Error with video:", err.message); // Log the error
      } finally {                             // Finally block runs regardless of success/failure
        console.log("[Instagram] Video processing complete. Closing browser..."); // Log closing
        await browser.close();                // Close the browser
      }
    }
  });

  const url = "https://www.instagram.com/reel/DRSKOoujopt/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ=="; // Instagram reel URL

  console.log("[Instagram] Opening reel page..."); // Log opening page
  await page.goto(url, { waitUntil: "domcontentloaded" }); // Navigate to the reel and wait for DOM to load

  console.log("[Instagram] Page loaded. Detecting video..."); // Log that page is loaded

  await waitForVideo(page);     // Wait for <video> tag to appear

  setTimeout(async () => {                     // Start a 10-second fallback timer
    if (!videoFound) {                        // If no video URL was captured within 10 seconds
      console.log("[Instagram] Timeout: No video URL captured. Closing browser..."); // Log timeout
      await browser.close();                  // Close the browser
    }
  }, 10000);                                   // Timeout set to 10,000 milliseconds (10 seconds)
})();                                         // End of main async function execution
