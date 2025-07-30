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
   * This uses a simple "catch window" to avoid repeated alerts for the same milestone.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if any site has crossed a new milestone.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    // Milestones in bytes.
    const milestones = [
      100 * 1024 * 1024 * 1024, // 100GB
      300 * 1024 * 1024 * 1024, // 300GB
      500 * 1024 * 1024 * 1024, // 500GB
      1024 * 1024 * 1024 * 1024, // 1TB
    ];

    return results.some((result) => {
      const bytes = result.total_download_bytes || 0;
      // A more robust solution would use a state file like cumulativeDataAlert.js,
      // but for now, we'll use a "catch window" to prevent spamming.
      const catchWindow = 10 * 1024 * 1024 * 1024; // 10GB
      return milestones.some(
        (milestone) => bytes >= milestone && bytes < milestone + catchWindow,
      );
    });
  },

  /**
   * Message function to generate the milestone celebration message.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, witty celebration message for Discord.
   */
  message: (results) => {
    const milestones = [
      {
        bytes: 100 * 1024 * 1024 * 1024,
        label: "100GB",
        emoji: "🥉",
        achievement: "Bronze Data Hoarder",
      },
      {
        bytes: 300 * 1024 * 1024 * 1024,
        label: "300GB",
        emoji: "🥈",
        achievement: "Silver Packet Pilferer",
      },
      {
        bytes: 500 * 1024 * 1024 * 1024,
        label: "500GB",
        emoji: "🥇",
        achievement: "Gold Gigabit Glutton",
      },
      {
        bytes: 1024 * 1024 * 1024 * 1024,
        label: "1TB",
        emoji: "💎",
        achievement: "Diamond Download Deity",
      },
    ];

    const achievements = [];
    const catchWindow = 10 * 1024 * 1024 * 1024; // 10GB

    results.forEach((result) => {
      const siteName = result.test_site || "The Shadow Realm";
      const bytes = result.total_download_bytes || 0;
      const gb = bytes / (1024 * 1024 * 1024);

      milestones.forEach((milestone) => {
        // Check if we're just past this milestone.
        if (bytes >= milestone.bytes && bytes < milestone.bytes + catchWindow) {
          achievements.push({
            site: siteName,
            ...milestone,
            currentGB: gb,
          });
        }
      });
    });

    if (achievements.length === 0) {
      // This should be unreachable if the condition function is correct.
      return "A milestone was detected, but it seems to have vanished. Spooky.";
    }

    let message = `📥 **DOWNLOAD MILESTONE ACHIEVED!** 📥\n\n`;

    achievements.forEach((achievement) => {
      message += `${achievement.emoji} **${achievement.site.toUpperCase()}** has just unlocked the **"${achievement.achievement}"** title!\n`;
      message += `**Total Downloaded:** A whopping **${achievement.currentGB.toFixed(2)}GB** (surpassing the ${achievement.label} mark!)\n\n`;
    });

    // Fun facts that are slightly more unhinged.
    const funFacts = [
      "That's enough data to download the entire Shrek movie franchise in 8K, 60fps. You're welcome.",
      "You could fill a modern smartphone with that data. Then wipe it. Then fill it again. Several times.",
      "If that data was water, you could fill a small swimming pool. Don't try to swim in it.",
      "Your hard drive is probably crying for mercy right now. Ignore it. More data is needed.",
      "That's enough bandwidth to make your ISP question all their life choices that led to offering 'unlimited' plans.",
      "You've officially downloaded more data than the average person's brain can even comprehend. You are a higher being now.",
      "This achievement is sponsored by insomnia and a deep-seated need to see progress bars complete.",
    ];

    const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    message += `💡 *Fun Fact: ${randomFact}*\n\n`;

    // Show current standings for a little friendly competition.
    message += `📊 **Current Download Leaderboard (Total GB):**\n`;
    const sortedResults = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        gb: (r.total_download_bytes || 0) / (1024 * 1024 * 1024),
      }))
      .sort((a, b) => b.gb - a.gb);

    sortedResults.forEach((entry, index) => {
      const medal =
        index === 0 ? "👑" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.gb.toFixed(2)}GB\n`;
    });

    message += `\n🎊 *The hunger for data is real. Keep those downloads coming!* 🚀`;

    return message;
  },
};
