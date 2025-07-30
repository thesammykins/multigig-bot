const { createDailyWinnersMessage } = require("../utils/discordUtils");

module.exports = {
  /**
   * Daily Performance Winners - Celebrates the daily champions in download, upload, and lowest latency!
   */
  name: "Daily Performance Winners",

  /**
   * Schedule: Run once per day to announce the daily champions
   */
  schedule: "daily",

  /**
   * InfluxQL query to get daily performance metrics for each test site
   * Gets max download/upload and min latency from the past 24 hours
   */
  query: `SELECT MAX(download_bandwidth) AS "max_download", MAX(upload_bandwidth) AS "max_upload", MIN(ping_latency) AS "min_latency" FROM "speedtest_result" WHERE time > now() - 24h GROUP BY "test_site"`,

  /**
   * Condition function - always triggers if we have data (daily report)
   * @param {Array} results - Query results from InfluxDB
   * @returns {boolean} - True if we have any performance data to report
   */
  condition: (results) => {
    return results && results.length > 0;
  },

  /**
   * Message function to generate daily winners announcement
   * @param {Array} results - Query results from InfluxDB
   * @returns {string} - Formatted daily winners message for Discord
   */
  message: (results) => {
    if (!results || results.length === 0) {
      return "🏆 **Daily Performance Awards** 🏆\n\nNo performance data available for today's ceremony! 📊❌";
    }

    // Find the winners in each category
    let downloadChampion = { site: "", speed: 0 };
    let uploadChampion = { site: "", speed: 0 };
    let latencyChampion = { site: "", latency: Infinity };

    results.forEach((result) => {
      const site = result.test_site || "Unknown";
      const download = result.max_download || 0;
      const upload = result.max_upload || 0;
      const latency = result.min_latency || Infinity;

      if (download > downloadChampion.speed) {
        downloadChampion = { site, speed: download };
      }
      if (upload > uploadChampion.speed) {
        uploadChampion = { site, speed: upload };
      }
      if (latency < latencyChampion.latency && latency > 0) {
        latencyChampion = { site, latency };
      }
    });

    // Prepare leaderboard data
    const downloadSorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        speed: ((r.max_download || 0) * 8) / 1000000,
      }))
      .sort((a, b) => b.speed - a.speed);

    const uploadSorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        speed: ((r.max_upload || 0) * 8) / 1000000,
      }))
      .sort((a, b) => b.speed - a.speed);

    const latencySorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        latency: r.min_latency || 999,
      }))
      .filter((r) => r.latency < 999)
      .sort((a, b) => a.latency - b.latency);

    // Fun closing messages
    const closingMessages = [
      "May your pings be low and your bandwidth high. Always. 🙏",
      "Another day, another gigabit conquered. Keep it up, champs. 💪",
      "You're making the internet a better place. Probably. 🌍",
      "These numbers are so good, your ISP is crying tears of joy. 😭",
      "You are the kings and queens of bandwidth. 👑",
      "Some chase dreams, you chase gigabits. And you're winning. 🏃‍♂️",
      "If speed was a crime, you'd all be serving life sentences. 🚔",
      "Your routers are the real MVPs. Give them a pat. ❤️",
    ];

    // Use utility to create a properly sized message
    return createDailyWinnersMessage(
      { downloadChampion, uploadChampion, latencyChampion },
      { downloadSorted, uploadSorted, latencySorted },
      closingMessages,
    );
  },
};
