const fs = require("fs");
const path = require("path");
const { createCumulativeMilestoneMessage } = require("../utils/discordUtils");

/**
 * CUMULATIVE DATA MILESTONE TRACKING FIX
 *
 * This alert was previously triggering repeatedly for the same milestone because
 * it didn't track which milestones had already been celebrated. The fix implements
 * persistent state tracking using a JSON file to remember which TB milestones
 * have been reached, ensuring each milestone is only celebrated once.
 *
 * Key improvements:
 * - Tracks celebrated milestones in persistent state file
 * - Only triggers when crossing a NEW milestone threshold
 * - Prevents duplicate notifications for the same milestone
 * - Uses writable locations (/tmp in Docker, config/ locally)
 */

// File to track celebrated milestones
// Use /tmp for writable location in Docker, fallback to config for local development
const milestoneStateFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/cumulativeMilestones.json"
    : path.join(__dirname, "../../config/cumulativeMilestones.json");

// Load celebrated milestones from state file
function loadCelebratedMilestones() {
  try {
    const data = fs.readFileSync(milestoneStateFile, "utf8");
    const milestones = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded celebrated milestones: ${JSON.stringify(milestones)}`,
    );
    return milestones;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("[DEBUG] No previous milestone state found, starting fresh");
    } else {
      console.warn(`[WARN] Failed to load milestone state: ${error.message}`);
    }
    return { celebratedTB: [], lastCelebrationTime: 0 };
  }
}

// Save celebrated milestones to state file
function saveCelebratedMilestones(milestones) {
  try {
    // Ensure directory exists
    const dir = path.dirname(milestoneStateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(milestoneStateFile, JSON.stringify(milestones, null, 2));
    console.log(
      `[DEBUG] Saved celebrated milestones: ${JSON.stringify(milestones)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save milestone state to ${milestoneStateFile}:`,
      error.message,
    );

    if (error.code === "EROFS" || error.code === "EACCES") {
      console.error(
        "[ERROR] File system is read-only or permission denied - milestones may be celebrated multiple times",
      );
    }
  }
}

module.exports = {
  /**
   * Cumulative Data Milestone Alert - Celebrates every 1TB of total data transferred!
   */
  name: "Cumulative Data Milestone Alert",

  /**
   * Schedule: Run every 5 minutes to catch milestones quickly
   */
  schedule: "5m",

  /**
   * InfluxQL query to get total cumulative data transferred across all test sites
   * This calculates the sum of all download and upload bytes ever recorded
   * Note: For true cumulative totals, we need to query all historical data
   */
  query: `SELECT SUM(download_bytes) as total_download_bytes, SUM(upload_bytes) as total_upload_bytes FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a new 1TB milestone that hasn't been celebrated yet
   * Includes rate limiting to prevent spam if multiple checks happen quickly
   * @param {Array} results - Query results from InfluxDB
   * @returns {boolean} - True if we've crossed a new 1TB milestone that hasn't been celebrated
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    const result = results[0];
    const totalBytes =
      (result.total_download_bytes || 0) + (result.total_upload_bytes || 0);

    const totalTB = totalBytes / (1024 * 1024 * 1024 * 1024); // Convert to TB

    // Check if we've crossed any 1TB milestone
    const currentMilestone = Math.floor(totalTB);

    // Must be at least 1TB to trigger
    if (currentMilestone < 1) {
      return false;
    }

    // Load celebrated milestones
    const milestoneState = loadCelebratedMilestones();

    // Rate limiting: Check if we celebrated any milestone in the last 10 minutes
    const now = Date.now();
    const lastCelebrationTime = milestoneState.lastCelebrationTime || 0;
    const timeSinceLastCelebration = now - lastCelebrationTime;
    const minTimeBetweenCelebrations = 10 * 60 * 1000; // 10 minutes

    if (timeSinceLastCelebration < minTimeBetweenCelebrations) {
      console.log(
        `[DEBUG] Rate limit: Last celebration was ${Math.round(timeSinceLastCelebration / 1000)}s ago, waiting ${Math.round((minTimeBetweenCelebrations - timeSinceLastCelebration) / 1000)}s more`,
      );
      return false;
    }

    // Check if this milestone has already been celebrated
    const alreadyCelebrated =
      milestoneState.celebratedTB.includes(currentMilestone);

    if (alreadyCelebrated) {
      console.log(
        `[DEBUG] ${currentMilestone}TB milestone already celebrated, skipping`,
      );
      return false;
    }

    // We have a new milestone to celebrate!
    console.log(
      `[INFO] New milestone detected: ${currentMilestone}TB (total: ${totalTB.toFixed(2)}TB)`,
    );

    // Mark this milestone as celebrated and update rate limiting timestamp
    milestoneState.celebratedTB.push(currentMilestone);
    milestoneState.celebratedTB.sort((a, b) => a - b); // Keep sorted
    milestoneState.lastCelebrationTime = now;
    saveCelebratedMilestones(milestoneState);

    return true;
  },

  /**
   * Message function to generate the milestone celebration
   * @param {Array} results - Query results from InfluxDB
   * @returns {string} - Formatted celebration message for Discord
   */
  message: (results) => {
    const result = results[0];
    const downloadBytes = result.total_download_bytes || 0;
    const uploadBytes = result.total_upload_bytes || 0;

    const totalBytes = downloadBytes + uploadBytes;

    const downloadTB = downloadBytes / (1024 * 1024 * 1024 * 1024);
    const uploadTB = uploadBytes / (1024 * 1024 * 1024 * 1024);
    const totalTB = totalBytes / (1024 * 1024 * 1024 * 1024);

    const currentMilestone = Math.floor(totalTB);

    // Fun milestone messages - cycle through them based on milestone number
    const milestoneMessages = [
      "That's enough data to stream 4K Netflix for over 150 hours straight.",
      "You could download Call of Duty: Modern Warfare about 5 times with this.",
      "This is more data than the Hubble Space Telescope sends back in a decade.",
      "We've used more bandwidth than a small, developing nation.",
      "That's enough data to store the entire Library of Congress in text files.",
      "If this data were floppy disks, it would reach the moon.",
      "This milestone is brought to you by caffeine and progress bar addiction.",
      "You could store about 35,000 high-quality albums in FLAC format.",
      "That's enough bandwidth to make ISP CEOs sweat during meetings.",
      "We've transferred enough data to fill 8,000 phone storages.",
      "This is like paving a digital highway to the internet's front door.",
      "If you printed this data on paper, you could deforest the Amazon.",
      "That's enough data to livestream your pet rock in 8K for a month.",
      "We've moved more data than all commercial flights generate daily.",
      "You've successfully backed up the internet's good parts.",
    ];

    // Use utility to create a properly sized message
    return createCumulativeMilestoneMessage(
      currentMilestone,
      { downloadTB, uploadTB, totalTB },
      milestoneMessages,
    );
  },
};
