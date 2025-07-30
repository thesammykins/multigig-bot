const fs = require("fs");
const path = require("path");

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
    return { celebratedTB: [] };
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
   */
  query: `SELECT SUM(download_bytes) as total_download_bytes, SUM(upload_bytes) as total_upload_bytes FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a new 1TB milestone that hasn't been celebrated yet
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

    // Mark this milestone as celebrated
    milestoneState.celebratedTB.push(currentMilestone);
    milestoneState.celebratedTB.sort((a, b) => a - b); // Keep sorted
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

    let message = `🎉 **MILESTONE ACHIEVED!** 🎉\n\n`;
    message += `🏆 **WE'VE CROSSED ${currentMilestone}TB OF TOTAL DATA!** 🏆\n\n`;

    message += `📊 **Current Stats:**\n`;
    message += `📥 **Total Downloaded:** ${downloadTB.toFixed(2)} TB\n`;
    message += `📤 **Total Uploaded:** ${uploadTB.toFixed(2)} TB\n`;
    message += `📈 **Grand Total:** ${totalTB.toFixed(2)} TB\n\n`;

    // Fun milestone messages - cycle through them based on milestone number
    const milestoneMessages = [
      "That's enough data to stream 4K Netflix for over 150 hours straight. Hope you've got snacks! 🍿",
      "You could download Call of Duty: Modern Warfare (the big one) about 5 times with this. Why? Don't ask. 🎮",
      "This is more data than the Hubble Space Telescope sends back in a decade. We're basically astronomers now. 🔭",
      "We've officially used more bandwidth than a small, developing nation. We should send them a postcard. 🌍",
      "That's enough data to store the entire Library of Congress... if it were all text files. Which it isn't. But still! 📚",
      "If this data were a stack of floppy disks, it would reach the moon. And probably burn up on re-entry. 💾",
      "This milestone is brought to you by caffeine, poor impulse control, and the sheer love of watching numbers go up. ☕",
      "You could store about 35,000 high-quality albums in FLAC format. Your ears would thank you. 🎵",
      "That's enough bandwidth to make our ISP's CEO sweat nervously during shareholder meetings. Keep it up. 👀",
      "We've now transferred enough data to fill up your phone's storage about 8,000 times. Time to delete some photos. 📸",
      "This is the digital equivalent of paving a highway to the internet's front door. Honk honk! 🚗",
      "If you printed this data on paper, you could deforest the entire Amazon. Good thing we're digital! 🌲",
      "That's enough data to livestream your pet rock's life in 8K for a month. It would be a very boring, very high-res stream. 🪨",
      "We've moved more data than all of the world's commercial flights generate in a day. We're flying high! ✈️",
      "Congratulations, you've successfully backed up the internet. Well, the good parts. Like, three cat videos and a recipe blog. 🐈",
    ];

    const messageIndex = (currentMilestone - 1) % milestoneMessages.length;
    const randomMessage = milestoneMessages[messageIndex];
    message += `💡 *${randomMessage}*\n\n`;

    // Add special messages for major milestones
    if (currentMilestone === 1) {
      message += `🎊 **FIRST TERABYTE CELEBRATION!** 🎊\n`;
      message += `*This is where legends are born! Welcome to the TB club!* 🌟\n\n`;
    } else if (currentMilestone === 5) {
      message += `🔥 **QUINTUPLE THREAT!** 🔥\n`;
      message += `*5TB down, infinity to go! You're officially addicted to data!* 🚀\n\n`;
    } else if (currentMilestone === 10) {
      message += `💯 **DOUBLE DIGITS BABY!** 💯\n`;
      message += `*10TB! At this point, you should probably start charging rent to your data!* 🏠\n\n`;
    } else if (currentMilestone % 10 === 0) {
      message += `🎯 **${currentMilestone}TB MEGA MILESTONE!** 🎯\n`;
      message += `*Round numbers deserve extra celebration! You're in the data hall of fame!* 👑\n\n`;
    }

    message += `🎊 **Congratulations to the entire MultiGig team!** 🎊\n`;
    message += `*Keep pushing those bytes! Next milestone: ${currentMilestone + 1}TB!* 💪\n\n`;

    // Show current milestone progress
    const nextMilestone = currentMilestone + 1;
    const progressTB = totalTB - currentMilestone;
    const progressPercent = (progressTB * 100).toFixed(1);

    message += `📈 **Progress to ${nextMilestone}TB:** ${progressTB.toFixed(2)}TB (${progressPercent}%)`;

    return message;
  },
};
