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

    let message = `🏆 **DAILY PERFORMANCE CHAMPIONS** 🏆\n`;
    message += `*Celebrating today's networking superstars!*\n\n`;

    // Download Champion
    if (downloadChampion.site && downloadChampion.speed > 0) {
      const downloadMbps = ((downloadChampion.speed * 8) / 1000000).toFixed(2);
      message += `📥 **Download Speed Champion** 🥇\n`;
      message += `**${downloadChampion.site.toUpperCase()}** achieved a blazing **${downloadMbps} Mbps**!\n`;
      message += `*Downloading at the speed of light!* ⚡\n\n`;
    }

    // Upload Champion
    if (uploadChampion.site && uploadChampion.speed > 0) {
      const uploadMbps = ((uploadChampion.speed * 8) / 1000000).toFixed(2);
      message += `📤 **Upload Speed Champion** 🥇\n`;
      message += `**${uploadChampion.site.toUpperCase()}** pushed **${uploadMbps} Mbps** upstream!\n`;
      message += `*Sending data to the stratosphere!* 🚀\n\n`;
    }

    // Latency Champion (lowest is best)
    if (latencyChampion.site && latencyChampion.latency < Infinity) {
      message += `⚡ **Lowest Latency Champion** 🥇\n`;
      message += `**${latencyChampion.site.toUpperCase()}** achieved lightning-fast **${latencyChampion.latency.toFixed(2)}ms** ping!\n`;
      message += `*Faster than a speeding photon!* 💨\n\n`;
    }

    // Full performance leaderboard
    message += `📊 **Complete Daily Performance Board:**\n\n`;

    // Download leaderboard
    message += `📥 **Download Speeds (Mbps):**\n`;
    const downloadSorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        speed: ((r.max_download || 0) * 8) / 1000000,
      }))
      .sort((a, b) => b.speed - a.speed);

    downloadSorted.forEach((entry, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔸";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.speed.toFixed(2)} Mbps\n`;
    });

    message += `\n📤 **Upload Speeds (Mbps):**\n`;
    const uploadSorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        speed: ((r.max_upload || 0) * 8) / 1000000,
      }))
      .sort((a, b) => b.speed - a.speed);

    uploadSorted.forEach((entry, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔸";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.speed.toFixed(2)} Mbps\n`;
    });

    message += `\n⚡ **Lowest Latency (ms):**\n`;
    const latencySorted = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        latency: r.min_latency || 999,
      }))
      .filter((r) => r.latency < 999)
      .sort((a, b) => a.latency - b.latency);

    latencySorted.forEach((entry, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔸";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.latency.toFixed(2)}ms\n`;
    });

    // Fun closing messages
    const closingMessages = [
      "May your pings be low and your bandwidth high. Always. 🙏",
      "Another day, another gigabit in the dust. Keep it up, champs. 💪",
      "You're not just testing speeds, you're making the internet a better place. Probably. 🌍",
      "These numbers are so good, your ISP is probably crying tears of joy. Or terror. 😭",
      "In the grand game of thrones, you are the kings and queens of bandwidth. 👑",
      "Some people chase dreams, you chase gigabits. And you're winning. 🏃‍♂️",
      "If speed was a crime, you'd all be serving life sentences. Keep breaking the law. 🚔",
      "Your routers are the real MVPs. Give them a little pat on the plastic. ❤️",
    ];

    const randomClosing =
      closingMessages[Math.floor(Math.random() * closingMessages.length)];
    message += `\n🎊 **Congratulations to all our speed warriors!** 🎊\n`;
    message += `*${randomClosing}*\n\n`;
    message += `🎯 *Ready for tomorrow's challenges? The internet awaits!* 🌐`;

    return message;
  },
};
