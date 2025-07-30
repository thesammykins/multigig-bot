const fs = require("fs");
const path = require("path");
const { createMilestoneMessage } = require("../utils/discordUtils");

/**
 * SITE UPLOAD MILESTONE TRACKING WITH PERSISTENT STATE
 *
 * This alert celebrates when individual sites hit various upload milestones.
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
    ? "/tmp/siteUploadMilestones.json"
    : path.join(__dirname, "../../config/siteUploadMilestones.json");

// Load celebrated milestones from state file
function loadCelebratedMilestones() {
  try {
    const data = fs.readFileSync(milestoneStateFile, "utf8");
    const milestones = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded site upload milestones: ${JSON.stringify(milestones)}`,
    );
    return milestones;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "[DEBUG] No previous site upload milestone state found, starting fresh",
      );
    } else {
      console.warn(
        `[WARN] Failed to load site upload milestone state: ${error.message}`,
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
      `[DEBUG] Saved site upload milestones: ${JSON.stringify(milestones)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save site upload milestone state: ${error.message}`,
    );
  }
}

module.exports = {
  /**
   * Site Upload Milestones Alert - Celebrates when individual sites become true upload champions.
   */
  name: "Site Upload Milestone Achievements",

  /**
   * Schedule: Run every 10 minutes because upload glory waits for no one.
   */
  schedule: "10m",

  /**
   * InfluxQL query to get the total cumulative upload bytes for each test site.
   */
  query: `SELECT SUM(upload_bytes) as total_upload_bytes FROM "speedtest_result" GROUP BY "test_site"`,

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
        `[DEBUG] Site upload milestone rate limit: Last celebration was ${Math.round(timeSinceLastCelebration / 1000)}s ago, waiting ${Math.round((minTimeBetweenCelebrations - timeSinceLastCelebration) / 1000)}s more`,
      );
      return false;
    }

    // Milestones in bytes with identifiers
    const milestones = [
      { id: "50GB", bytes: 50 * 1024 * 1024 * 1024 },
      { id: "200GB", bytes: 200 * 1024 * 1024 * 1024 },
      { id: "500GB", bytes: 500 * 1024 * 1024 * 1024 },
      { id: "1TB", bytes: 1024 * 1024 * 1024 * 1024 },
    ];

    // Check if any site has reached a new milestone
    return results.some((result) => {
      const siteName = result.test_site || "Unknown";
      const bytes = result.total_upload_bytes || 0;

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
   * Message function to generate the upload milestone celebration message.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, witty celebration message for Discord.
   */
  message: (results) => {
    // Load current milestone state
    const celebratedMilestones = loadCelebratedMilestones();

    const milestones = [
      {
        id: "50GB",
        bytes: 50 * 1024 * 1024 * 1024,
        label: "50GB",
        emoji: "🥉",
        achievement: "Bronze Contributor",
      },
      {
        id: "200GB",
        bytes: 200 * 1024 * 1024 * 1024,
        label: "200GB",
        emoji: "🥈",
        achievement: "Silver Broadcaster",
      },
      {
        id: "500GB",
        bytes: 500 * 1024 * 1024 * 1024,
        label: "500GB",
        emoji: "🥇",
        achievement: "Gold Data Donor",
      },
      {
        id: "1TB",
        bytes: 1024 * 1024 * 1024 * 1024,
        label: "1TB",
        emoji: "💎",
        achievement: "Diamond Upload Deity",
      },
    ];

    const achievements = [];

    results.forEach((result) => {
      const siteName = result.test_site || "The Ether";
      const bytes = result.total_upload_bytes || 0;
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
      return "An upload milestone was hit, but it slipped through our fingers. We'll get it next time.";
    }

    // Prepare leaderboard data
    const leaderboardData = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        gb: (r.total_upload_bytes || 0) / (1024 * 1024 * 1024),
      }))
      .sort((a, b) => b.gb - a.gb);

    // Fun facts about uploading things
    const uploadFacts = [
      "That's enough data to host your own private cloud. Who needs Dropbox?",
      "You could livestream your cat sleeping in 4K to a global audience.",
      "If you were seeding Linux ISOs, you'd be a hero of the open-source community.",
      "Your ISP's 'symmetrical speed' claims are being put to the test, and you're winning.",
      "You've contributed more data to the internet than most people consume in a month.",
      "This achievement is sponsored by fiber optics and progress bar hatred.",
      "At this rate, you're going to need a bigger data pipe. Or maybe a fire hose.",
    ];

    // Use utility to create a properly sized message
    return createMilestoneMessage(achievements, leaderboardData, {
      title: "📤 **UPLOAD MILESTONE CONQUERED!** 📤",
      funFacts: uploadFacts,
      type: "upload",
      maxLeaderboardEntries: 8,
    });
  },
};
