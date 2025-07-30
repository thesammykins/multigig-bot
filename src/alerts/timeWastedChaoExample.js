/**
 * Time Wasted Chaos Alert - Example of converting an existing alert to chaos scheduling
 *
 * This is a modified version of timeWastedAlert.js that demonstrates how to convert
 * any existing alert to use chaos scheduling with minimal changes.
 *
 * Changes made:
 * 1. Changed schedule from "15m" to "chaos:20m"
 * 2. Updated comments to reflect chaos behavior
 * 3. No other code changes needed - chaos scheduling is automatic!
 */

module.exports = {
  /**
   * Collective Time Wasted Chaos Alert - Now with unpredictable timing!
   */
  name: "Collective Time Wasted Chaos Alert",

  /**
   * CHAOS SCHEDULE: Check every 20 minutes, but fire randomly based on probability
   *
   * Original was "15m" (every 15 minutes, predictable)
   * Now "chaos:20m" (check every 20 minutes, fire unpredictably)
   *
   * Expected behavior:
   * - Checks every 20 minutes for potential execution
   * - 5% base chance increasing to 15% over 3 hours
   * - Will fire randomly between ~30 minutes to 4+ hours
   * - Perfect for non-critical time milestone celebrations
   */
  schedule: "chaos:20m",

  /**
   * InfluxQL query to get the total time spent on all speed tests.
   * This sums the download and upload elapsed time across all tests ever run.
   *
   * (No changes needed for chaos scheduling)
   */
  query: `SELECT SUM(download_elapsed) as total_download_time, SUM(upload_elapsed) as total_upload_time FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a significant time-wasting milestone.
   *
   * NOTE: With chaos scheduling, this condition is only evaluated when the chaos
   * scheduler decides it's time for a potential execution. The original logic
   * remains exactly the same!
   *
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if we've crossed a new time milestone.
   */
  condition: (results) => {
    // Only trigger in test mode - this is an example alert for demonstration
    const isTestMode =
      process.env.TEST_MODE === "true" ||
      process.env.TEST_WEBHOOK === "true" ||
      process.env.NODE_ENV === "test";

    if (!isTestMode) {
      return false;
    }

    if (!results || results.length === 0) {
      return false;
    }

    const result = results[0];
    const totalSeconds =
      (result.total_download_time || 0) + (result.total_upload_time || 0);
    const totalHours = totalSeconds / 3600; // Convert to hours

    // Milestones in hours.
    const milestones = [8, 16, 24, 48, 72, 168]; // 8h, 16h, 24h, 2 days, 3 days, 1 week

    // A more robust solution would use a state file, but for now, we'll use a "catch window".
    const catchWindow = 0.5; // 30 minutes
    return milestones.some(
      (milestone) =>
        totalHours >= milestone && totalHours < milestone + catchWindow,
    );
  },

  /**
   * Message function to generate the time-wasted celebration message.
   *
   * Enhanced with chaos scheduling awareness for demonstration.
   *
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, sarcastic celebration message for Discord.
   */
  message: (results) => {
    const result = results[0];
    const downloadSeconds = result.total_download_time || 0;
    const uploadSeconds = result.total_upload_time || 0;
    const totalSeconds = downloadSeconds + uploadSeconds;

    const totalHours = totalSeconds / 3600;
    const totalDays = totalHours / 24;

    // Determine which milestone we just hit.
    const milestones = [
      {
        hours: 8,
        emoji: "⏰",
        title: "The 'Just One More Test' Award",
        subtitle: "8 Hours of Pure, Unadulterated Speed Testing",
      },
      {
        hours: 16,
        emoji: "🕰️",
        title: "The 'I Can Stop Anytime' Trophy",
        subtitle: "16 Hours Blissfully Lost to the Bandwidth Gods",
      },
      {
        hours: 24,
        emoji: "📅",
        title: "The 'Lost Day' Commemorative Plate",
        subtitle: "A Full 24 Hours Sacrificed for Science",
      },
      {
        hours: 48,
        emoji: "🗓️",
        title: "The 'Weekend Obliterator' Medal",
        subtitle: "Two Days of Non-Stop Digital Diligence",
      },
      {
        hours: 72,
        emoji: "⏳",
        title: "The 'Three-Day Bender' Ribbon",
        subtitle: "72 Hours of Glorious, Unproductive Productivity",
      },
      {
        hours: 168,
        emoji: "🗓️",
        title: "The 'One Week Gone' Perpetual Motion Trophy",
        subtitle: "A Full Week of Our Lives, For The Data!",
      },
    ];

    let currentMilestone = null;
    for (const milestone of milestones.slice().reverse()) {
      if (totalHours >= milestone.hours) {
        currentMilestone = milestone;
        break;
      }
    }

    if (!currentMilestone) {
      return "A time milestone was reached, but it seems to have escaped into the temporal vortex.";
    }

    let message = `${currentMilestone.emoji} **TIME MILESTONE REACHED!** ${currentMilestone.emoji}\n\n`;
    message += `🏆 **We've unlocked the "${currentMilestone.title}"!** 🏆\n`;
    message += `*${currentMilestone.subtitle}*\n\n`;

    // Add chaos scheduling note
    message += `🎲 **Chaos Alert Notice:** This milestone celebration was delivered at a completely unpredictable time by our chaos scheduling system! The perfect surprise timing for a time-wasting achievement! 🎭\n\n`;

    message += `⏱️ **The Grim Statistics:**\n`;
    message += `📥 **Download Testing Time:** ${(downloadSeconds / 3600).toFixed(2)} hours\n`;
    message += `📤 **Upload Testing Time:** ${(uploadSeconds / 3600).toFixed(2)} hours\n`;
    message += `⏰ **Total Time Vaporized:** **${totalHours.toFixed(2)} hours** (${totalDays.toFixed(2)} days)\n\n`;

    // Fun time-wasted comparisons that are more unhinged.
    const timeComparisons = [
      `That's enough time to watch the entire Lord of the Rings trilogy (Extended Edition, of course) ${Math.floor(totalHours / 12)} times.`,
      `In this time, you could have learned to bake a really, really good sourdough. Instead, you cooked these numbers.`,
      `That's equivalent to ${Math.floor(totalHours / 8)} full workdays. Let's not tell our bosses.`,
      `You could have flown from New York to London ${Math.floor(totalHours / 7)} times. Our data has traveled much further.`,
      `That's enough time to binge-watch an entire season of a prestige TV drama. The drama here is our obsession.`,
      `You've now spent more time staring at speed tests than the average person spends choosing a Netflix show.`,
      `That's ${Math.floor(totalHours * 60)} minutes of your life you'll never get back. But look at the pretty graphs!`,
    ];

    const randomComparison =
      timeComparisons[Math.floor(Math.random() * timeComparisons.length)];
    message += `🤔 *A Matter of Perspective: ${randomComparison}*\n\n`;

    // Motivational, but sarcastic, closing messages enhanced with chaos theme.
    const closingMessages = [
      "Time you enjoy wasting is not wasted time. Right? ...Right? The chaos scheduler certainly thinks so!",
      "This is for science. And for glory. Mostly for glory. And for chaos!",
      "Your dedication is an inspiration to procrastinators everywhere. The unpredictable timing makes it even better!",
      "Who needs a social life when you have symmetrical gigabit internet and chaotic milestone celebrations?",
      "They say time is money. We say time is bandwidth. And chaos makes both more interesting!",
      "Future historians will look back at this and say... 'Wow, they really liked unpredictable speed test milestones.'",
      "You haven't just tested the speed, you've tested the very limits of time itself. And chaos scheduling!",
      "The chaos gods smiled upon this moment, delivering your milestone at the perfect unpredictable time!",
    ];

    const randomClosing =
      closingMessages[Math.floor(Math.random() * closingMessages.length)];
    message += `🎊 **Congratulations on this monumentally chaotic achievement!** 🎊\n`;
    message += `*${randomClosing}*\n\n`;

    // Next milestone teaser.
    const nextMilestone = milestones.find((m) => m.hours > totalHours);
    if (nextMilestone) {
      const hoursToGo = nextMilestone.hours - totalHours;
      message += `🎯 *Next up: The "${nextMilestone.title}" in just ${hoursToGo.toFixed(1)} more hours!*\n`;
      message += `🎲 *When will the chaos scheduler deliver that milestone? Nobody knows! That's the beauty of it!*`;
    } else {
      message += `🏆 *You've transcended time itself. You are now a Speed Test Sage with chaotic timing powers.*`;
    }

    return message;
  },
};
