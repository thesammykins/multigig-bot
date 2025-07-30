/**
 * Chaos Scheduling Example Alert
 *
 * This is a demonstration alert showing how to use the chaos scheduling system.
 * It provides examples of different chaos scheduling configurations and shows
 * how the unpredictable timing works in practice.
 */

module.exports = {
  /**
   * Example Chaos Alert - Demonstrates unpredictable scheduling
   */
  name: "Chaos Scheduling Example",

  /**
   * Chaos Schedule Examples:
   *
   * "chaos"        - Uses default 15m check frequency, 5% base chance increasing over 3 hours
   * "chaos:5m"     - Checks every 5 minutes for maximum chaos
   * "chaos:1h"     - Checks hourly for more predictable chaos
   * "chaos:30s"    - Checks every 30 seconds for real-time chaos (use sparingly!)
   *
   * This example uses 10-minute checks for moderate unpredictability.
   */
  schedule: "chaos:10m",

  /**
   * Simple query to demonstrate chaos scheduling with actual data
   */
  query: `SELECT COUNT(*) as test_count, MAX(download_bandwidth) as max_download FROM "speedtest_result" WHERE time > now() - 1h`,

  /**
   * Condition function - always triggers when called to demonstrate chaos timing
   * Note: The chaos probability is handled automatically by the scheduling system,
   * so this condition just needs to determine if there's something worth reporting.
   *
   * @param {Array} results - Query results from InfluxDB
   * @returns {boolean} - True if we have any data to report
   */
  condition: (results) => {
    // Always trigger if we have any data - the chaos scheduling handles the randomness
    // This lets us see exactly when the chaos scheduler decides to fire
    return results && results.length > 0;
  },

  /**
   * Message function to show chaos scheduling in action
   * @param {Array} results - Query results from InfluxDB
   * @returns {string} - A message explaining the chaos scheduling behavior
   */
  message: (results) => {
    const result = results[0] || {};
    const testCount = result.test_count || 0;
    const maxDownload = result.max_download || 0;
    const maxDownloadMbps = maxDownload > 0 ? ((maxDownload * 8) / 1000000).toFixed(2) : "0";

    const now = new Date().toLocaleString();

    let message = `🎲 **CHAOS SCHEDULING DEMONSTRATION** 🎲\n\n`;
    message += `⚡ **Random Strike Time:** ${now}\n\n`;

    message += `🎯 **How Chaos Scheduling Works:**\n`;
    message += `• **Check Frequency:** Every 10 minutes (as configured)\n`;
    message += `• **Base Chance:** 5% probability each check\n`;
    message += `• **Time Multiplier:** Increases up to 3x over 3 hours\n`;
    message += `• **Result:** Unpredictable timing between ~20 minutes to 4+ hours\n\n`;

    message += `📊 **Current Network Snapshot (Last Hour):**\n`;
    message += `• Speed tests detected: ${testCount}\n`;
    message += `• Peak download speed: ${maxDownloadMbps} Mbps\n\n`;

    // Fun chaos-themed messages
    const chaosMessages = [
      "This message appeared because the chaos gods smiled upon us! 🎭",
      "Probability smiled and said 'today is the day!' 🎲",
      "The randomness aligned perfectly with the cosmic forces of scheduling! 🌟",
      "Against all odds (well, 5-15% odds), here we are! 🎪",
      "The chaos scheduler rolled the dice and we won! 🎯",
      "This is what happens when controlled randomness meets digital destiny! ⚡",
      "The unpredictable became predictably unpredictable! 🤹",
      "Chaos theory in action: small probabilities, big surprises! 🔬",
      "The schedule said 'maybe' and the universe said 'yes!' 🌌",
      "This message is brought to you by the beautiful chaos of probability! 🎨"
    ];

    const randomChaosMessage = chaosMessages[Math.floor(Math.random() * chaosMessages.length)];
    message += `🎪 **Chaos Commentary:** ${randomChaosMessage}\n\n`;

    message += `🔧 **For Alert Developers:**\n`;
    message += `To use chaos scheduling in your alerts:\n`;
    message += `1. Set \`schedule: "chaos"\` or \`schedule: "chaos:15m"\`\n`;
    message += `2. Write your condition normally - chaos probability is automatic\n`;
    message += `3. Enjoy unpredictable but statistically sound timing!\n\n`;

    message += `📈 **Chaos Schedule Options:**\n`;
    message += `• \`"chaos"\` - Default 15m checks (recommended)\n`;
    message += `• \`"chaos:5m"\` - High frequency chaos (5m checks)\n`;
    message += `• \`"chaos:1h"\` - Low frequency chaos (hourly checks)\n`;
    message += `• \`"chaos:30s"\` - Maximum chaos (use carefully!)\n\n`;

    message += `*The next chaos strike could be in 20 minutes... or 4 hours. That's the beauty of controlled randomness!* 🎭`;

    return message;
  }
};
