module.exports = {
  /**
   * Worst Latency Award - A tongue-in-cheek celebration of the worst network performance (runs twice daily).
   */
  name: "Worst Latency Award",

  /**
   * Schedule: Run every 12 hours to "honor" the laggards twice daily (prevents collision with other daily alerts).
   */
  schedule: "12h",

  /**
   * InfluxQL query to get the maximum (worst) latency and jitter values for each test site over the past day.
   */
  query: `SELECT MAX("ping_latency") AS "max_ping_latency", MAX("download_latency_iqm") AS "max_download_latency", MAX("upload_latency_iqm") AS "max_upload_latency", MAX("ping_jitter") AS "max_ping_jitter" FROM "speedtest_result" WHERE time > now() - 1d GROUP BY "test_site"`,

  /**
   * Condition function - always triggers if we have data, because every day deserves a "winner".
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if there's any data to report.
   */
  condition: (results) => {
    // This is a twice-daily report, not an alert. If there's data, we want to see it.
    return results && results.length > 0;
  },

  /**
   * Message function to generate the daily "award" announcement.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, sarcastic celebration message for Discord.
   */
  message: (results) => {
    if (!results || results.length === 0) {
      return "🏆 **The Lag Awards** 🏆\n\nNo data available for this ceremony! Everyone was too fast, apparently. 🤷‍♂️";
    }

    // Find the "winner" in each category (higher is worse).
    let worstPing = { site: "", value: -1 };
    let worstDownload = { site: "", value: -1 };
    let worstUpload = { site: "", value: -1 };
    let worstJitter = { site: "", value: -1 };

    // Determine the overall "grand champion" of lag.
    let overallWorst = { site: "", metric: "", value: -1 };

    results.forEach((result) => {
      const site = result.test_site || "The Void";
      const ping = result.max_ping_latency || 0;
      const download = result.max_download_latency || 0;
      const upload = result.max_upload_latency || 0;
      const jitter = result.max_ping_jitter || 0;

      // Track the worst in each category.
      if (ping > worstPing.value) worstPing = { site, value: ping };
      if (download > worstDownload.value)
        worstDownload = { site, value: download };
      if (upload > worstUpload.value) worstUpload = { site, value: upload };
      if (jitter > worstJitter.value) worstJitter = { site, value: jitter };

      // Track the overall worst performer.
      if (ping > overallWorst.value)
        overallWorst = { site, metric: "Ping Latency", value: ping };
      if (download > overallWorst.value)
        overallWorst = { site, metric: "Download Latency", value: download };
      if (upload > overallWorst.value)
        overallWorst = { site, metric: "Upload Latency", value: upload };
      if (jitter > overallWorst.value)
        overallWorst = { site, metric: "Ping Jitter", value: jitter };
    });

    let message = `🐢 **THE LAG AWARDS** 🐢\n`;
    message += `*Let's celebrate our most patient and... deliberate network connections!*\n\n`;

    // Announce the grand champion.
    if (overallWorst.site) {
      message += `🥇 **GRAND CHAMPION OF LAG** 🥇\n`;
      message += `A huge round of applause for **${overallWorst.site.toUpperCase()}**, who achieved a breathtaking **${overallWorst.value.toFixed(1)}ms ${overallWorst.metric}**!\n`;
      message += `*Truly a performance for the history books. We're all in awe.* 🤯\n\n`;
    }

    // Category "winners".
    message += `📊 **Category Winners (Losers?):**\n\n`;

    message += `🐌 **The 'Did it Freeze?' Ping Award:**\n`;
    message += `• **${worstPing.site.toUpperCase()}** with a leisurely **${worstPing.value.toFixed(1)}ms** ping.\n\n`;

    message += `📉 **The 'Buffering...' Download Latency Trophy:**\n`;
    message += `• **${worstDownload.site.toUpperCase()}** hitting a staggering **${worstDownload.value.toFixed(1)}ms**.\n\n`;

    message += `📈 **The 'Is This Thing On?' Upload Latency Medal:**\n`;
    message += `• **${worstUpload.site.toUpperCase()}** with a majestic **${worstUpload.value.toFixed(1)}ms**.\n\n`;

    message += ` convulsing **${worstJitter.value.toFixed(1)}ms**.\n\n`;

    // Full leaderboard of shame.
    message += `📋 **The Wall of Shame (Worst Ping):**\n`;
    const sortedByPing = results
      .map((r) => ({
        site: r.test_site || "Unknown",
        ping: r.max_ping_latency || 0,
      }))
      .sort((a, b) => b.ping - a.ping);

    sortedByPing.forEach((entry, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "💩";
      message += `${medal} **${entry.site.toUpperCase()}**: ${entry.ping.toFixed(1)}ms\n`;
    });

    message += `\n🎊 *A heartfelt congratulations to all our participants. Remember, it's not about winning, it's about... participating.* 🎊\n`;
    message += `💡 *As they say, patience is a virtue. And you all are very, very virtuous.*`;

    return message;
  },
};
