const fs = require("fs");
const path = require("path");

/**
 * COLLECTIVE TIME WASTED CHAOS ALERT WITH PERSISTENT STATE
 *
 * This is a modified version of timeWastedAlert.js that demonstrates how to convert
 * any existing alert to use chaos scheduling with minimal changes, now with proper
 * persistent state tracking to prevent duplicate notifications.
 *
 * Changes made from original timeWastedAlert.js:
 * 1. Changed schedule from "15m" to "chaos:20m"
 * 2. Added test mode check for example alert safety
 * 3. Updated comments to reflect chaos behavior
 * 4. Added persistent state tracking to prevent duplicate milestones
 * 5. Enhanced with chaos-themed messaging
 */

// File to track celebrated time milestones for chaos version
// Use /tmp for writable location in Docker, fallback to config for local development
const milestoneStateFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/timeWastedChaosMilestones.json"
    : path.join(__dirname, "../../config/timeWastedChaosMilestones.json");

// Load celebrated milestones from state file
function loadCelebratedMilestones() {
  try {
    const data = fs.readFileSync(milestoneStateFile, "utf8");
    const milestones = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded time wasted chaos milestones: ${JSON.stringify(milestones)}`,
    );
    return milestones;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "[DEBUG] No previous time wasted chaos milestone state found, starting fresh",
      );
    } else {
      console.warn(
        `[WARN] Failed to load time wasted chaos milestone state: ${error.message}`,
      );
    }
    return { celebratedHours: [] };
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
      `[DEBUG] Saved time wasted chaos milestones: ${JSON.stringify(milestones)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save time wasted chaos milestone state: ${error.message}`,
    );
  }
}

module.exports = {
  /**
   * Collective Time Wasted Chaos Alert - Now with unpredictable timing and persistent state!
   */
  name: "Collective Time Wasted Chaos Alert",

  /**
   * CHAOS SCHEDULE: Check every 20 minutes, but fire randomly based on probability
   *
   * Original was "15m" (every 15 minutes, predictable)
   * Now "chaos:20m" (check every 20 minutes, fire unpredictably)
   *
   * Expected behavior:
   * - Checks every 20 minutes for potential execution
   * - 5% base chance increasing to 15% over 3 hours
   * - Will fire randomly between ~30 minutes to 4+ hours
   * - Perfect for non-critical time milestone celebrations
   */
  schedule: "chaos:20m",

  /**
   * InfluxQL query to get the total time spent on all speed tests.
   * This sums the download and upload elapsed time across all tests ever run.
   *
   * (No changes needed for chaos scheduling)
   */
  query: `SELECT SUM(download_elapsed) as total_download_time, SUM(upload_elapsed) as total_upload_time FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a significant time-wasting milestone.
   *
   * NOTE: With chaos scheduling, this condition is only evaluated when the chaos
   * scheduler decides it's time for a potential execution. The original logic
   * remains exactly the same, but now with persistent state tracking!
   *
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if we've crossed a new time milestone.
   */
  condition: (results) => {
    // Only trigger in test mode - this is an example alert for demonstration
    const isTestMode =
      process.env.TEST_MODE === "true" ||
      process.env.TEST_WEBHOOK === "true" ||
      process.env.NODE_ENV === "test";

    if (!isTestMode) {
      return false;
    }

    if (!results || results.length === 0) {
      return false;
    }

    const result = results[0];
    const totalSeconds =
      (result.total_download_time || 0) + (result.total_upload_time || 0);
    const totalHours = totalSeconds / 3600; // Convert to hours

    // Milestones in hours with identifiers (chaos version has additional milestones)
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

    // Check if we've reached any new milestone
    return milestones.some((milestone) => {
      const hasReachedMilestone = totalHours >= milestone.hours;
      const alreadyCelebrated = milestoneState.celebratedHours.includes(
        milestone.id,
      );

      if (hasReachedMilestone && !alreadyCelebrated) {
        console.log(
          `[INFO] New chaos time milestone detected: ${milestone.id} (${totalHours.toFixed(2)} hours total)`,
        );

        // Mark this milestone as celebrated
        milestoneState.celebratedHours.push(milestone.id);
        milestoneState.celebratedHours.sort(); // Keep sorted for cleaner logs
        saveCelebratedMilestones(milestoneState);

        return true;
      }

      return false;
    });
  },

  /**
   * Message function to generate the time-wasted celebration message.
   *
   * Enhanced with chaos scheduling awareness and persistent state tracking.
   *
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, sarcastic celebration message for Discord.
   */
  message: (results) => {
    const result = results[0];
    const downloadSeconds = result.total_download_time || 0;
    const uploadSeconds = result.total_upload_time || 0;
    const totalSeconds = downloadSeconds + uploadSeconds;

    const totalHours = totalSeconds / 3600;
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
      return "A chaotic time milestone was reached, but it seems to have escaped into the temporal vortex.";
    }

    let message = `${currentMilestone.emoji} **CHAOTIC TIME MILESTONE REACHED!** ${currentMilestone.emoji}\n\n`;
    message += `🏆 **We've unlocked the "${currentMilestone.title}"!** 🏆\n`;
    message += `*${currentMilestone.subtitle}*\n\n`;

    // Add chaos scheduling note with persistent state awareness
    message += `🎲 **Chaos Alert Notice:** This milestone celebration was delivered at a completely unpredictable time by our chaos scheduling system! The perfect surprise timing for a time-wasting achievement! 🎭\n\n`;
    message += `💾 **State Tracking:** This milestone has been permanently recorded to prevent duplicate celebrations. Chaos with precision! 🎯\n\n`;

    message += `⏱️ **The Grim Statistics:**\n`;
    message += `📥 **Download Testing Time:** ${(downloadSeconds / 3600).toFixed(2)} hours\n`;
    message += `📤 **Upload Testing Time:** ${(uploadSeconds / 3600).toFixed(2)} hours\n`;
    message += `⏰ **Total Time Vaporized:** **${totalHours.toFixed(2)} hours** (${totalDays.toFixed(2)} days)\n\n`;

    // Fun time-wasted comparisons enhanced with chaos themes.
    const timeComparisons = [
      `That's enough time to watch the entire Lord of the Rings trilogy (Extended Edition, of course) ${Math.floor(totalHours / 12)} times. The chaos scheduler timed this perfectly!`,
      `In this time, you could have learned to bake a really, really good sourdough. Instead, you cooked these numbers with chaotic timing.`,
      `That's equivalent to ${Math.floor(totalHours / 8)} full workdays. The chaos gods chose this moment to remind you!`,
      `You could have flown from New York to London ${Math.floor(totalHours / 7)} times. Our chaotic data has traveled much further.`,
      `That's enough time to binge-watch an entire season of a prestige TV drama. The real drama is this unpredictable notification timing!`,
      `You've now spent more time staring at speed tests than the average person spends choosing a Netflix show. Chaos made this revelation possible!`,
      `That's ${Math.floor(totalHours * 60)} minutes of your life you'll never get back. But the chaos scheduler made it memorable!`,
      `You could have read War and Peace ${Math.floor(totalHours / 15)} times. Instead, you read bandwidth statistics with chaotic dedication.`,
      `That's enough time to become fluent in a new language. The language of chaotic latency analysis, apparently.`,
      `You've dedicated more time to this than most people spend planning their weddings. The chaos scheduler approves of your priorities!`,
    ];

    const randomComparison =
      timeComparisons[Math.floor(Math.random() * timeComparisons.length)];
    message += `🤔 *A Matter of Chaotic Perspective: ${randomComparison}*\n\n`;

    // Motivational, but sarcastic, closing messages enhanced with chaos theme.
    const closingMessages = [
      "Time you enjoy wasting is not wasted time. Right? ...Right? The chaos scheduler certainly thinks so!",
      "This is for science. And for glory. Mostly for glory. And for chaos!",
      "Your dedication is an inspiration to procrastinators everywhere. The unpredictable timing makes it even better!",
      "Who needs a social life when you have symmetrical gigabit internet and chaotic milestone celebrations?",
      "They say time is money. We say time is bandwidth. And chaos makes both more interesting!",
      "Future historians will look back at this and say... 'Wow, they really liked unpredictable speed test milestones.'",
      "You haven't just tested the speed, you've tested the very limits of time itself. And chaos scheduling!",
      "The chaos gods smiled upon this moment, delivering your milestone at the perfect unpredictable time!",
      "This achievement will look great on your digital resume. Under 'Hobbies: Professional Chaotic Time Waster.'",
      "You've transcended mere mortal concerns and achieved true chaotic digital enlightenment.",
      "At this rate, you'll achieve legendary status in the Chaotic Speed Test Hall of Fame.",
      "The universe conspired with our chaos scheduler to deliver this milestone at precisely the right wrong time!",
    ];

    const randomClosing =
      closingMessages[Math.floor(Math.random() * closingMessages.length)];
    message += `🎊 **Congratulations on this monumentally chaotic achievement!** 🎊\n`;
    message += `*${randomClosing}*\n\n`;

    // Next milestone teaser with chaos theme.
    const nextMilestone = milestones.find((m) => m.hours > totalHours);
    if (nextMilestone) {
      const hoursToGo = nextMilestone.hours - totalHours;
      message += `🎯 *Next up: The "${nextMilestone.title}" in just ${hoursToGo.toFixed(1)} more hours!*\n`;
      message += `🎲 *When will the chaos scheduler deliver that milestone? Nobody knows! That's the beauty of it!*\n`;
      message += `💾 *Don't worry - when it happens, we'll remember it permanently thanks to our state tracking!*`;
    } else {
      message += `🏆 *You've transcended time itself. You are now a Speed Test Sage with chaotic timing powers and persistent memory.*`;
    }

    return message;
  },
};
