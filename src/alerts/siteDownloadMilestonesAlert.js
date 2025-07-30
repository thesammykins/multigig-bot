const fs = require("fs");
const path = require("path");
const { createMilestoneMessage } = require("../utils/discordUtils");

/**
 * SITE DOWNLOAD MILESTONE TRACKING WITH PERSISTENT STATE
 *
 * This alert celebrates when individual sites hit various download milestones.
 * It uses persistent state tracking to remember which milestones have already
 * been celebrated for each site, preventing duplicate notifications.
 *
 * Key features:
 * - Tracks celebrated milestones per site in persistent state file
 * - Only triggers when crossing a NEW milestone threshold
 * - Prevents duplicate notifications for the same milestone
 * - Uses writable locations (/tmp in Docker, config/ locally)
 */

// File to track celebrated milestones per site
// Use /tmp for writable location in Docker, fallback to config for local development
const milestoneStateFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/siteDownloadMilestones.json"
    : path.join(__dirname, "../../config/siteDownloadMilestones.json");

// Load celebrated milestones from state file
function loadCelebratedMilestones() {
  try {
    const data = fs.readFileSync(milestoneStateFile, "utf8");
    const milestones = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded site download milestones: ${JSON.stringify(milestones)}`,
    );
    return milestones;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "[DEBUG] No previous site download milestone state found, starting fresh",
      );
    } else {
      console.warn(
        `[WARN] Failed to load site download milestone state: ${error.message}`,
      );
    }
    return { lastCelebrationTime: 0 };
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
      `[DEBUG] Saved site download milestones: ${JSON.stringify(milestones)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save site download milestone state: ${error.message}`,
    );
  }
}

module.exports = {
  /**
   * Site Download Milestones Alert - Celebrates when individual sites hit various download milestones.
   */
  name: "Site Download Milestones Alert",

  /**
   * Schedule: Run every 10 minutes to catch milestones reasonably quickly.
   */
  schedule: "10m",

  /**
   * InfluxQL query to get the total cumulative download bytes for each test site.
   */
  query: `SELECT SUM(download_bytes) as total_download_bytes FROM "speedtest_result" GROUP BY "test_site"`,

  /**
   * Condition function - triggers when any site crosses a new milestone it hasn't passed before.
   * Uses persistent state tracking to prevent duplicate notifications.
   * Includes rate limiting to prevent spam if multiple checks happen quickly.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if any site has crossed a new milestone.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    // Load current milestone state
    const celebratedMilestones = loadCelebratedMilestones();

    // Rate limiting: Check if we celebrated any milestone in the last 10 minutes
    const now = Date.now();
    const lastCelebrationTime = celebratedMilestones.lastCelebrationTime || 0;
    const timeSinceLastCelebration = now - lastCelebrationTime;
    const minTimeBetweenCelebrations = 10 * 60 * 1000; // 10 minutes

    if (timeSinceLastCelebration < minTimeBetweenCelebrations) {
      console.log(
        `[DEBUG] Site milestone rate limit: Last celebration was ${Math.round(timeSinceLastCelebration / 1000)}s ago, waiting ${Math.round((minTimeBetweenCelebrations - timeSinceLastCelebration) / 1000)}s more`,
      );
      return false;
    }

    // Milestones in bytes with identifiers
    const milestones = [
      { id: "100GB", bytes: 100 * 1024 * 1024 * 1024 },
      { id: "300GB", bytes: 300 * 1024 * 1024 * 1024 },
      { id: "500GB", bytes: 500 * 1024 * 1024 * 1024 },
      { id: "1TB", bytes: 1024 * 1024 * 1024 * 1024 },
    ];

    // Check if any site has reached a new milestone
    return results.some((result) => {
      const siteName = result.test_site || "Unknown";
      const bytes = result.total_download_bytes || 0;

      // Get or initialize celebrated milestones for this site
      if (!celebratedMilestones[siteName]) {
        celebratedMilestones[siteName] = [];
      }

      // Check if this site has reached any new milestones
      const hasNewMilestone = milestones.some((milestone) => {
        const hasReachedMilestone = bytes >= milestone.bytes;
        const alreadyCelebrated = celebratedMilestones[siteName].includes(
          milestone.id,
        );

        if (hasReachedMilestone && !alreadyCelebrated) {
          // Update the celebration time when we find a new milestone
          celebratedMilestones.lastCelebrationTime = now;
          return true;
        }

        return false;
      });

      return hasNewMilestone;
    });
  },

  /**
   * Message function to generate the milestone celebration message.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, witty celebration message for Discord.
   */
  message: (results) => {
    // Load current milestone state
    const celebratedMilestones = loadCelebratedMilestones();

    const milestones = [
      {
        id: "100GB",
        bytes: 100 * 1024 * 1024 * 1024,
        label: "100GB",
        emoji: "🥉",
        achievement: "Bronze Data Hoarder",
      },
      {
        id: "300GB",
        bytes: 300 * 1024 * 1024 * 1024,
        label: "300GB",
        emoji: "🥈",
        achievement: "Silver Packet Pilferer",
      },
      {
        id: "500GB",
        bytes: 500 * 1024 * 1024 * 1024,
        label: "500GB",
        emoji: "🥇",
        achievement: "Gold Gigabit Glutton",
      },
      {
        id: "1TB",
        bytes: 1024 * 1024 * 1024 * 1024,
        label: "1TB",
        emoji: "💎",
        achievement: "Diamond Download Deity",
      },
    ];

    const achievements = [];

    results.forEach((result) => {
      const siteName = result.test_site || "The Shadow Realm";
      const bytes = result.total_download_bytes || 0;
      const gb = bytes / (1024 * 1024 * 1024);

      // Get or initialize celebrated milestones for this site
      if (!celebratedMilestones[siteName]) {
        celebratedMilestones[siteName] = [];
      }

      milestones.forEach((milestone) => {
        const hasReachedMilestone = bytes >= milestone.bytes;
        const alreadyCelebrated = celebratedMilestones[siteName].includes(
          milestone.id,
        );

        // Only celebrate new milestones
        if (hasReachedMilestone && !alreadyCelebrated) {
          achievements.push({
            site: siteName,
            ...milestone,
            currentGB: gb,
          });

          // Mark this milestone as celebrated for this site
          celebratedMilestones[siteName].push(milestone.id);
        }
      });
    });

    // Save updated milestone state
    saveCelebratedMilestones(celebratedMilestones);

    if (achievements.length === 0) {
      // This should be unreachable if the condition function is correct.
      return "A milestone was detected, but it seems to have vanished. Spooky.";
    }

    // Prepare leaderboard data
    const leaderboardData = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        gb: (r.total_download_bytes || 0) / (1024 * 1024 * 1024),
      }))
      .sort((a, b) => b.gb - a.gb);

    // Fun facts that are slightly more unhinged
    const funFacts = [
      "That's enough data to download the entire Shrek movie franchise in 8K, 60fps.",
      "You could fill a modern smartphone with that data. Then wipe it. Then fill it again.",
      "If that data was water, you could fill a small swimming pool. Don't try to swim in it.",
      "Your hard drive is probably crying for mercy right now. Ignore it. More data is needed.",
      "That's enough bandwidth to make your ISP question offering 'unlimited' plans.",
      "You've downloaded more data than the average person's brain can comprehend.",
      "This achievement is sponsored by insomnia and progress bar completion addiction.",
    ];

    // Use utility to create a properly sized message
    return createMilestoneMessage(achievements, leaderboardData, {
      title: "📥 **DOWNLOAD MILESTONE ACHIEVED!** 📥",
      funFacts,
      type: "download",
      maxLeaderboardEntries: 8,
    });
  },
};
