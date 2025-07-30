const fs = require("fs");
const path = require("path");
const { createTimeMilestoneMessage } = require("../utils/discordUtils");

/**
 * COLLECTIVE TIME WASTED MILESTONE TRACKING WITH PERSISTENT STATE
 *
 * This alert celebrates the time we've collectively sacrificed to the speed test gods.
 * It uses persistent state tracking to remember which time milestones have already
 * been celebrated, preventing duplicate notifications.
 *
 * Key features:
 * - Tracks celebrated time milestones in persistent state file
 * - Only triggers when crossing a NEW milestone threshold
 * - Prevents duplicate notifications for the same milestone
 * - Uses writable locations (/tmp in Docker, config/ locally)
 */

// File to track celebrated time milestones
// Use /tmp for writable location in Docker, fallback to config for local development
const milestoneStateFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/timeWastedMilestones.json"
    : path.join(__dirname, "../../config/timeWastedMilestones.json");

// Load celebrated milestones from state file
function loadCelebratedMilestones() {
  try {
    const data = fs.readFileSync(milestoneStateFile, "utf8");
    const milestones = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded time wasted milestones: ${JSON.stringify(milestones)}`,
    );
    return milestones;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "[DEBUG] No previous time wasted milestone state found, starting fresh",
      );
    } else {
      console.warn(
        `[WARN] Failed to load time wasted milestone state: ${error.message}`,
      );
    }
    return { celebratedHours: [], lastCelebrationTime: 0 };
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
      `[DEBUG] Saved time wasted milestones: ${JSON.stringify(milestones)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save time wasted milestone state: ${error.message}`,
    );
  }
}

module.exports = {
  /**
   * Collective Time Wasted Alert - A celebration of the time we've collectively sacrificed to the speed test gods.
   */
  name: "Collective Time Wasted Alert",

  /**
   * Schedule: Run every 15 minutes, because time is flying when you're having fun.
   */
  schedule: "15m",

  /**
   * InfluxQL query to get the total time spent on all speed tests.
   * This sums the download and upload elapsed time across all tests ever run.
   */
  query: `SELECT SUM(download_elapsed) as total_download_time, SUM(upload_elapsed) as total_upload_time FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a significant time-wasting milestone that hasn't been celebrated yet.
   * Includes rate limiting to prevent spam if multiple checks happen quickly.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if we've crossed a new time milestone.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    const result = results[0];
    const totalMilliseconds =
      (result.total_download_time || 0) + (result.total_upload_time || 0);
    const totalHours = totalMilliseconds / 3600000; // Convert milliseconds to hours

    // Milestones in hours with identifiers
    const milestones = [
      { id: "8h", hours: 8 },
      { id: "16h", hours: 16 },
      { id: "24h", hours: 24 },
      { id: "48h", hours: 48 },
      { id: "72h", hours: 72 },
      { id: "168h", hours: 168 }, // 1 week
      { id: "336h", hours: 336 }, // 2 weeks
      { id: "720h", hours: 720 }, // 1 month
    ];

    // Load celebrated milestones
    const milestoneState = loadCelebratedMilestones();

    // Rate limiting: Check if we celebrated any milestone in the last 15 minutes
    const now = Date.now();
    const lastCelebrationTime = milestoneState.lastCelebrationTime || 0;
    const timeSinceLastCelebration = now - lastCelebrationTime;
    const minTimeBetweenCelebrations = 15 * 60 * 1000; // 15 minutes

    if (timeSinceLastCelebration < minTimeBetweenCelebrations) {
      console.log(
        `[DEBUG] Time milestone rate limit: Last celebration was ${Math.round(timeSinceLastCelebration / 1000)}s ago, waiting ${Math.round((minTimeBetweenCelebrations - timeSinceLastCelebration) / 1000)}s more`,
      );
      return false;
    }

    // Check if we've reached any new milestone
    return milestones.some((milestone) => {
      const hasReachedMilestone = totalHours >= milestone.hours;
      const alreadyCelebrated = milestoneState.celebratedHours.includes(
        milestone.id,
      );

      if (hasReachedMilestone && !alreadyCelebrated) {
        console.log(
          `[INFO] New time milestone detected: ${milestone.id} (${totalHours.toFixed(2)} hours total)`,
        );

        // Mark this milestone as celebrated and update rate limiting timestamp
        milestoneState.celebratedHours.push(milestone.id);
        milestoneState.celebratedHours.sort(); // Keep sorted for cleaner logs
        milestoneState.lastCelebrationTime = now;
        saveCelebratedMilestones(milestoneState);

        return true;
      }

      return false;
    });
  },

  /**
   * Message function to generate the time-wasted celebration message.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, sarcastic celebration message for Discord.
   */
  message: (results) => {
    const result = results[0];
    const downloadMilliseconds = result.total_download_time || 0;
    const uploadMilliseconds = result.total_upload_time || 0;
    const totalMilliseconds = downloadMilliseconds + uploadMilliseconds;

    const totalHours = totalMilliseconds / 3600000; // Convert milliseconds to hours
    const totalDays = totalHours / 24;

    // Determine which milestone we just hit.
    const milestones = [
      {
        id: "8h",
        hours: 8,
        emoji: "⏰",
        title: "The 'Just One More Test' Award",
        subtitle: "8 Hours of Pure, Unadulterated Speed Testing",
      },
      {
        id: "16h",
        hours: 16,
        emoji: "🕰️",
        title: "The 'I Can Stop Anytime' Trophy",
        subtitle: "16 Hours Blissfully Lost to the Bandwidth Gods",
      },
      {
        id: "24h",
        hours: 24,
        emoji: "📅",
        title: "The 'Lost Day' Commemorative Plate",
        subtitle: "A Full 24 Hours Sacrificed for Science",
      },
      {
        id: "48h",
        hours: 48,
        emoji: "🗓️",
        title: "The 'Weekend Obliterator' Medal",
        subtitle: "Two Days of Non-Stop Digital Diligence",
      },
      {
        id: "72h",
        hours: 72,
        emoji: "⏳",
        title: "The 'Three-Day Bender' Ribbon",
        subtitle: "72 Hours of Glorious, Unproductive Productivity",
      },
      {
        id: "168h",
        hours: 168,
        emoji: "🗓️",
        title: "The 'One Week Gone' Perpetual Motion Trophy",
        subtitle: "A Full Week of Our Lives, For The Data!",
      },
      {
        id: "336h",
        hours: 336,
        emoji: "📆",
        title: "The 'Fortnight of Fiber' Excellence Award",
        subtitle: "Two Weeks of Dedicated Digital Devotion",
      },
      {
        id: "720h",
        hours: 720,
        emoji: "🏆",
        title: "The 'Monthly Madness' Championship Belt",
        subtitle: "One Month of Pure Speed Test Supremacy",
      },
    ];

    let currentMilestone = null;
    for (const milestone of milestones.slice().reverse()) {
      if (totalHours >= milestone.hours) {
        currentMilestone = milestone;
        break;
      }
    }

    if (!currentMilestone) {
      return "A time milestone was reached, but it seems to have escaped into the temporal vortex.";
    }

    // Fun time-wasted comparisons that are more compact
    const timeComparisons = [
      `That's enough time to watch LOTR trilogy ${Math.floor(totalHours / 12)} times.`,
      `You could have learned to bake sourdough. Instead, you cooked these numbers.`,
      `That's ${Math.floor(totalHours / 8)} full workdays. Don't tell the boss.`,
      `You could have flown NYC to London ${Math.floor(totalHours / 7)} times.`,
      `That's enough time to binge an entire TV drama season.`,
      `You've spent more time on speed tests than choosing Netflix shows.`,
      `That's ${Math.floor(totalHours * 60)} minutes you'll never get back. Pretty graphs though!`,
      `You could have read War and Peace ${Math.floor(totalHours / 15)} times.`,
      `That's enough time to become fluent in a new language. The language of latency.`,
      `You've dedicated more time to this than planning most weddings. Priorities!`,
    ];

    // Motivational, but sarcastic, closing messages
    const closingMessages = [
      "Time you enjoy wasting is not wasted time. Right?",
      "This is for science. And glory. Mostly glory.",
      "Your dedication inspires procrastinators everywhere.",
      "Who needs social life when you have gigabit internet?",
      "They say time is money. We say time is bandwidth.",
      "Future historians will say 'Wow, they really liked speed tests.'",
      "You've tested the very limits of time itself.",
      "This will look great on your digital resume under 'Hobbies.'",
      "You've achieved true digital enlightenment.",
      "You're achieving legendary Speed Test Hall of Fame status.",
    ];

    // Find next milestone
    const nextMilestone = milestones.find((m) => m.hours > totalHours);

    // Use utility to create a properly sized message
    return createTimeMilestoneMessage(
      currentMilestone,
      {
        downloadHours: downloadMilliseconds / 3600000, // Convert milliseconds to hours
        uploadHours: uploadMilliseconds / 3600000, // Convert milliseconds to hours
        totalHours,
        totalDays,
      },
      timeComparisons,
      closingMessages,
      nextMilestone,
    );
  },
};
