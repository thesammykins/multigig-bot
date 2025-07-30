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
   * Condition function - triggers when any site crosses a new upload milestone.
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
      50 * 1024 * 1024 * 1024, // 50GB
      200 * 1024 * 1024 * 1024, // 200GB
      500 * 1024 * 1024 * 1024, // 500GB
      1024 * 1024 * 1024 * 1024, // 1TB
    ];

    // A more robust solution would use a state file like cumulativeDataAlert.js,
    // but for now, we'll use a "catch window" to prevent spamming.
    const catchWindow = 5 * 1024 * 1024 * 1024; // 5GB

    return results.some((result) => {
      const bytes = result.total_upload_bytes || 0;
      return milestones.some(
        (milestone) => bytes >= milestone && bytes < milestone + catchWindow,
      );
    });
  },

  /**
   * Message function to generate the upload milestone celebration message.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, witty celebration message for Discord.
   */
  message: (results) => {
    const milestones = [
      {
        bytes: 50 * 1024 * 1024 * 1024,
        label: "50GB",
        emoji: "🥉",
        achievement: "Bronze Contributor",
      },
      {
        bytes: 200 * 1024 * 1024 * 1024,
        label: "200GB",
        emoji: "🥈",
        achievement: "Silver Broadcaster",
      },
      {
        bytes: 500 * 1024 * 1024 * 1024,
        label: "500GB",
        emoji: "🥇",
        achievement: "Gold Data Donor",
      },
      {
        bytes: 1024 * 1024 * 1024 * 1024,
        label: "1TB",
        emoji: "💎",
        achievement: "Diamond Upload Deity",
      },
    ];

    const achievements = [];
    const catchWindow = 5 * 1024 * 1024 * 1024; // 5GB

    results.forEach((result) => {
      const siteName = result.test_site || "The Ether";
      const bytes = result.total_upload_bytes || 0;
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
      return "An upload milestone was hit, but it slipped through our fingers. We'll get it next time.";
    }

    let message = `📤 **UPLOAD MILESTONE CONQUERED!** 📤\n\n`;

    achievements.forEach((achievement) => {
      message += `${achievement.emoji} **${achievement.site.toUpperCase()}** has ascended to the rank of **"${achievement.achievement}"**!\n`;
      message += `**Total Uploaded:** A staggering **${achievement.currentGB.toFixed(2)}GB** (smashing the ${achievement.label} barrier!)\n\n`;
    });

    // Fun facts about uploading things.
    const uploadFacts = [
      "That's enough data to host your own private cloud. Who needs Dropbox when you have this kind of power?",
      "You could livestream your cat sleeping in 4K to a global audience. The world needs to see this.",
      "If you were seeding Linux ISOs, you'd be a hero of the open-source community. We see you.",
      "Your ISP's 'symmetrical speed' claims are being put to the test, and you are winning.",
      "You've officially contributed more data to the internet than most people consume in a month. A true digital philanthropist.",
      "This achievement is sponsored by fiber optics and a deep-seated hatred of progress bars.",
      "At this rate, you're going to need a bigger data pipe. Or maybe a fire hose.",
    ];

    const randomFact =
      uploadFacts[Math.floor(Math.random() * uploadFacts.length)];
    message += `💡 *Upload Wisdom: ${randomFact}*\n\n`;

    // Show current upload standings for that sweet, sweet competition.
    message += `📊 **Current Upload Leaderboard (Total GB):**\n`;
    const sortedResults = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        gb: (r.total_upload_bytes || 0) / (1024 * 1024 * 1024),
      }))
      .sort((a, b) => b.gb - a.gb);

    sortedResults.forEach((entry, index) => {
      const medal =
        index === 0 ? "👑" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.gb.toFixed(2)}GB\n`;
    });

    message += `\n🚀 *Don't stop now! The internet is hungry for more uploads!*`;

    return message;
  },
};
