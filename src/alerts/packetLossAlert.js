module.exports = {
  /**
   * Real-time Packet Loss Alert - Monitors for any packet loss across test sites.
   */
  name: "Real-time Packet Loss Alert",

  /**
   * Schedule: Run every minute for real-time monitoring because lost packets are no joke.
   */
  schedule: "1m",

  /**
   * InfluxQL query to get the most recent packet loss percentage from all test sites.
   * Looks at the last 2 minutes to ensure we catch recent events.
   */
  query: `SELECT last("packet_loss") AS "packet_loss" FROM "speedtest_result" WHERE time > now() - 2m GROUP BY "test_site"`,

  /**
   * Condition function to detect significant packet loss.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if any site has packet loss > 5%.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false; // No data, no problem.
    }

    // Alert if any site reports packet loss greater than 5%.
    // Minor packet loss under 5% is considered normal network behavior.
    return results.some((result) => (result.packet_loss || 0) > 5);
  },

  /**
   * Message function to generate an urgent packet loss notification.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, urgent, and slightly panicked message for Discord.
   */
  message: (results) => {
    // Filter for sites that are losing significant packets (>5%).
    const affectedSites = results.filter(
      (result) => (result.packet_loss || 0) > 5,
    );

    if (affectedSites.length === 0) {
      // This should not happen if the condition function is working correctly, but just in case.
      return "Detected a disturbance in the force, but all packets seem to be accounted for. Carry on.";
    }

    let message = `🚨 **ALERT: PACKETS ARE GOING MISSING!** 🚨\n\n`;
    message += `It seems some of our data packets have decided to go on an unscheduled vacation. We need to find them!\n\n`;
    message += `**Sites with Wandering Packets:**\n`;

    affectedSites.forEach((site) => {
      const testSite = site.test_site || "The Bermuda Triangle";
      const packetLoss = (site.packet_loss || 0).toFixed(2);
      const severity =
        packetLoss > 15
          ? "🔥 (This is fine.)"
          : packetLoss > 10
            ? "😨 (Getting a bit sweaty)"
            : "⚠️ (Above acceptable threshold)";

      message += `🔴 **${testSite.toUpperCase()}**: **${packetLoss}%** packet loss ${severity}\n`;
    });

    // Also show sites that are within acceptable loss range, for context.
    const healthySites = results.filter(
      (result) => (result.packet_loss || 0) <= 5,
    );

    if (healthySites.length > 0) {
      message += `\n✅ **Sites Within Acceptable Range (≤5%):**\n`;
      healthySites.forEach((site) => {
        const testSite = site.test_site || "Unknown";
        const packetLoss = (site.packet_loss || 0).toFixed(2);
        message += `🟢 **${testSite.toUpperCase()}**: ${packetLoss}% packet loss (Within normal parameters)\n`;
      });
    }

    message += `\n\n⚠️ **ACTION REQUIRED:** Someone please check the network cables! Are they plugged in? Are they on fire? Let's investigate!\n`;
    message += `*This alert is your friendly neighborhood packet loss patrol, checking in every minute.*`;

    return message;
  },
};
