module.exports = {
  /**
   * Collective Time Wasted Alert - A celebration of the time we've collectively sacrificed to the speed test gods.
   */
  name: "Collective Time Wasted Alert",

  /**
   * Schedule: Run every 15 minutes, because time is flying when you're having fun.
   */
  schedule: "15m",

  /**
   * InfluxQL query to get the total time spent on all speed tests.
   * This sums the download and upload elapsed time across all tests ever run.
   */
  query: `SELECT SUM(download_elapsed) as total_download_time, SUM(upload_elapsed) as total_upload_time FROM "speedtest_result"`,

  /**
   * Condition function - triggers when we cross a significant time-wasting milestone.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - True if we've crossed a new time milestone.
   */
  condition: (results) => {
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

    // Motivational, but sarcastic, closing messages.
    const closingMessages = [
      "Time you enjoy wasting is not wasted time. Right? ...Right?",
      "This is for science. And for glory. Mostly for glory.",
      "Your dedication is an inspiration to procrastinators everywhere.",
      "Who needs a social life when you have symmetrical gigabit internet?",
      "They say time is money. We say time is bandwidth. And we are rich.",
      "Future historians will look back at this and say... 'Wow, they really liked speed tests.'",
      "You haven't just tested the speed, you've tested the very limits of time itself.",
    ];

    const randomClosing =
      closingMessages[Math.floor(Math.random() * closingMessages.length)];
    message += `🎊 **Congratulations on this monumental achievement!** 🎊\n`;
    message += `*${randomClosing}*\n\n`;

    // Next milestone teaser.
    const nextMilestone = milestones.find((m) => m.hours > totalHours);
    if (nextMilestone) {
      const hoursToGo = nextMilestone.hours - totalHours;
      message += `🎯 *Next up: The "${nextMilestone.title}" in just ${hoursToGo.toFixed(1)} more hours!*`;
    } else {
      message += `🏆 *You've transcended time itself. You are now a Speed Test Sage.*`;
    }

    return message;
  },
};
