module.exports = {
  /**
   * A friendly name for the alert. This will be used in logs.
   */
  name: "Manual Webhook Test Alert",

  /**
   * Schedule: Runs infrequently since this is a manual test
   * This alert only triggers when TEST_WEBHOOK environment variable is set to 'true'
   * Usage: TEST_WEBHOOK=true npm start
   */
  schedule: "1m", // Run every minute when TEST_WEBHOOK is set

  /**
   * Simple test query to verify InfluxDB connectivity.
   * This query gets the count of speedtest results from the last hour.
   * If this returns data, we know the database connection is working.
   */
  query: `SELECT COUNT(*) FROM "speedtest_result" WHERE time > now() - 1h`,

  /**
   * A function that evaluates the results of the query.
   * @param {Array} results - The results from the InfluxDB query.
   * @returns {boolean} - Only returns true when TEST_WEBHOOK environment variable is set.
   *
   * This test alert only triggers when manually requested via environment variable.
   * Usage: TEST_WEBHOOK=true npm start
   */
  condition: (results) => {
    // Only trigger if TEST_WEBHOOK environment variable is set to 'true'
    if (process.env.TEST_WEBHOOK !== "true") {
      return false;
    }

    // Always return true for webhook test when environment variable is set
    // This allows testing even if database is not connected
    return true;
  },

  /**
   * A function that generates the test notification message.
   * @param {Array} results - The results from the InfluxDB query.
   * @returns {string} - The test message to be sent to the Discord webhook.
   *
   * This function generates a simple test message to verify webhook connectivity.
   */
  message: (results) => {
    const now = new Date().toLocaleString();
    const dbConnected = results && results.length > 0;
    const testCount = dbConnected ? results[0]?.count || 0 : "N/A";

    let message = `🧪 **MANUAL WEBHOOK TEST ALERT** 🧪\n\n`;
    message += `✅ **Status:** Manual test triggered successfully!\n`;
    message += `⏰ **Time:** ${now}\n`;
    message += `📊 **Database Status:** ${dbConnected ? `Connected (${testCount} records in last hour)` : "Not connected (credentials may need configuration)"}\n\n`;

    message += `🎯 **Test Results:**\n`;
    message += `• ${dbConnected ? "InfluxDB query executed successfully" : "InfluxDB connection failed (expected for initial setup)"}\n`;
    message += `• Alert condition triggered manually via TEST_WEBHOOK=true\n`;
    message += `• Discord webhook is receiving messages ✅\n\n`;

    message += `🚀 **Your MultiGig Bot webhook is working!**\n`;
    message += `*${dbConnected ? "All systems operational!" : "Configure InfluxDB credentials in config/config.json to enable data alerts"}*\n`;
    message += `*To test again, restart with TEST_WEBHOOK=true*`;

    return message;
  },
};
