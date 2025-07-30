module.exports = {
  /**
   * Dramatic Speed Change Alert - Detects when download speeds go completely off the rails between consecutive tests.
   */
  name: "Dramatic Speed Change Alert",

  /**
   * Schedule: Run every 2 minutes to catch speed anomalies quickly.
   */
  schedule: "2m",

  /**
   * InfluxQL query to get the last 3 download bandwidth measurements for each test site.
   * We need multiple measurements to compare consecutive runs and detect dramatic changes.
   */
  query: `SELECT download_bandwidth FROM "speedtest_result" WHERE time > now() - 1h GROUP BY "test_site" ORDER BY time DESC LIMIT 3`,

  /**
   * Condition function - triggers when any site shows a dramatic speed change (>40%) between consecutive tests.
   * @param {Array} results - Query results from InfluxDB grouped by test_site.
   * @returns {boolean} - True if any site has a dramatic speed change.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    // Group results by test_site and check for dramatic changes
    const siteGroups = {};

    results.forEach((result) => {
      const site = result.test_site || "Unknown";
      if (!siteGroups[site]) {
        siteGroups[site] = [];
      }
      siteGroups[site].push(result);
    });

    // Check each site for dramatic speed changes
    return Object.values(siteGroups).some((siteResults) => {
      if (siteResults.length < 2) {
        return false; // Need at least 2 measurements to compare
      }

      // Sort by time descending (most recent first)
      siteResults.sort((a, b) => new Date(b.time) - new Date(a.time));

      const currentSpeed = siteResults[0].download_bandwidth || 0;
      const previousSpeed = siteResults[1].download_bandwidth || 0;

      // Skip if either speed is zero or unreasonably low (< 50 Mbps in bytes/sec)
      const minThreshold = (50 * 1000000) / 8; // 50 Mbps in bytes/sec
      if (currentSpeed < minThreshold || previousSpeed < minThreshold) {
        return false;
      }

      // Calculate percentage change
      const percentChange =
        Math.abs((currentSpeed - previousSpeed) / previousSpeed) * 100;

      // Alert if change is greater than 40%
      return percentChange > 40;
    });
  },

  /**
   * Message function to generate a dramatic and sarcastic alert about speed changes.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, panicked message about speed anomalies.
   */
  message: (results) => {
    // Group results by test_site for analysis
    const siteGroups = {};

    results.forEach((result) => {
      const site = result.test_site || "The Void";
      if (!siteGroups[site]) {
        siteGroups[site] = [];
      }
      siteGroups[site].push(result);
    });

    const dramaticChanges = [];

    Object.entries(siteGroups).forEach(([site, siteResults]) => {
      if (siteResults.length < 2) return;

      // Sort by time descending (most recent first)
      siteResults.sort((a, b) => new Date(b.time) - new Date(a.time));

      const currentSpeed = siteResults[0].download_bandwidth || 0;
      const previousSpeed = siteResults[1].download_bandwidth || 0;

      // Skip if either speed is too low
      const minThreshold = (50 * 1000000) / 8;
      if (currentSpeed < minThreshold || previousSpeed < minThreshold) return;

      const percentChange =
        ((currentSpeed - previousSpeed) / previousSpeed) * 100;
      const absPercentChange = Math.abs(percentChange);

      if (absPercentChange > 40) {
        // Convert bytes/sec to Mbps for display
        const currentMbps = (currentSpeed * 8) / 1000000;
        const previousMbps = (previousSpeed * 8) / 1000000;

        dramaticChanges.push({
          site,
          currentMbps: currentMbps.toFixed(0),
          previousMbps: previousMbps.toFixed(0),
          percentChange: percentChange.toFixed(1),
          absPercentChange: absPercentChange.toFixed(1),
          isIncrease: percentChange > 0,
          severity:
            absPercentChange > 80
              ? "🔥 NUCLEAR"
              : absPercentChange > 60
                ? "💥 EXPLOSIVE"
                : "⚡ DRAMATIC",
        });
      }
    });

    if (dramaticChanges.length === 0) {
      return "🤔 A dramatic speed change was detected, but it seems to have vanished into the ethernet. Spooky.";
    }

    let message = `🚨 **SPEED SHOCK ALERT: THE INTERNET IS HAVING AN IDENTITY CRISIS!** 🚨\n\n`;
    message += `Houston, we have a problem. Someone's internet connection just went completely off-script!\n\n`;

    // Report each dramatic change
    dramaticChanges.forEach((change, index) => {
      const {
        site,
        currentMbps,
        previousMbps,
        percentChange,
        absPercentChange,
        isIncrease,
        severity,
      } = change;

      message += `${severity} **${site.toUpperCase()}** ${severity}\n`;

      if (isIncrease) {
        message += `📈 **SPEED SURGE:** ${previousMbps} Mbps → **${currentMbps} Mbps** (+${absPercentChange}%)\n`;
        message += `*Someone either upgraded their internet or made a pact with the bandwidth demons.* 😈\n\n`;
      } else {
        message += `📉 **SPEED CRASH:** ${previousMbps} Mbps → **${currentMbps} Mbps** (-${absPercentChange}%)\n`;
        message += `*Your connection just forgot how to internet properly. Time to panic!* 😱\n\n`;
      }
    });

    // Add some context and panic-inducing commentary
    message += `⚠️ **WHAT THIS MEANS:**\n`;
    if (dramaticChanges.some((c) => c.isIncrease)) {
      message += `• Someone's internet just achieved enlightenment 🧘‍♂️\n`;
      message += `• The ISP gods have blessed this connection 🙏\n`;
      message += `• Possible causes: Upgrade, fiber alignment with celestial bodies, or pure luck ✨\n`;
    }
    if (dramaticChanges.some((c) => !c.isIncrease)) {
      message += `• The internet is having an existential crisis 😰\n`;
      message += `• Possible causes: Network congestion, ISP throttling, or digital ghosts 👻\n`;
      message += `• Someone should probably check if the cables are still plugged in 🔌\n`;
    }

    message += `\n🔍 **INVESTIGATION PROTOCOL:**\n`;
    message += `1. Check if anyone is downloading the entire internet again 🌐\n`;
    message += `2. Verify that your router hasn't achieved sentience and gone rogue 🤖\n`;
    message += `3. Consider the possibility that your ISP is just messing with you 🎭\n`;
    message += `4. Run another test because we're all addicted to these numbers anyway 📊\n\n`;

    // Sarcastic closing based on the type of change
    const panicMessages = [
      "Remember: Your internet speed is like your mood - unpredictable and slightly concerning.",
      "This has been your regularly scheduled internet drama update. Stay tuned for more chaos.",
      "In a world of stable connections, dare to be dramatically different. Mission accomplished.",
      "Your bandwidth just pulled a plot twist worthy of a Netflix series. Binge-worthy content!",
      "This speed change is so dramatic, it deserves its own documentary series.",
      "Breaking news: Local internet connection refuses to behave predictably. More at 11.",
      "Physics called - they want to study your connection as a case study in chaos theory.",
    ];

    const randomPanic =
      panicMessages[Math.floor(Math.random() * panicMessages.length)];
    message += `*${randomPanic}* 🎪`;

    return message;
  },
};
