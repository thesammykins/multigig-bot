/**
 * Discord Utility Functions
 *
 * Provides utilities for handling Discord-specific requirements like message length limits.
 */

/**
 * Discord message character limit
 */
const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Truncates a Discord message to fit within the character limit.
 * Attempts to preserve message structure by truncating sections intelligently.
 *
 * @param {string} message - The full message to truncate
 * @param {number} limit - Character limit (default: Discord's 2000)
 * @returns {string} - Truncated message that fits within the limit
 */
function truncateMessage(message, limit = DISCORD_MESSAGE_LIMIT) {
  if (message.length <= limit) {
    return message;
  }

  // Try to find a good truncation point
  const truncationPoint = limit - 100; // Leave room for truncation notice

  // Look for natural break points (double newlines, section breaks)
  const naturalBreaks = ["\n\n", "\n📊", "\n💡", "\n🎊", "\n🚀"];

  for (const breakPoint of naturalBreaks) {
    const lastBreak = message.lastIndexOf(breakPoint, truncationPoint);
    if (lastBreak > truncationPoint * 0.7) {
      // Don't truncate too early
      return (
        message.substring(0, lastBreak) +
        "\n\n⚠️ *Message truncated due to length limits*"
      );
    }
  }

  // If no natural break found, truncate at word boundary
  let truncated = message.substring(0, truncationPoint);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > truncationPoint * 0.9) {
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated + "\n\n⚠️ *Message truncated due to length limits*";
}

/**
 * Truncates a leaderboard section to fit within remaining character budget.
 *
 * @param {Array} entries - Array of leaderboard entries
 * @param {number} remainingChars - How many characters are left in the budget
 * @param {Function} formatEntry - Function to format each entry
 * @returns {string} - Formatted leaderboard that fits within the budget
 */
function truncateLeaderboard(entries, remainingChars, formatEntry) {
  const header = "📊 **Current Leaderboard:**\n";
  const footer = "\n🎊 *Keep up the great work!*";
  const truncationNotice = "\n*(Leaderboard truncated)*";

  let availableChars = remainingChars - header.length - footer.length;
  let result = header;
  let entriesAdded = 0;

  for (const entry of entries) {
    const formattedEntry = formatEntry(entry, entriesAdded);

    // Check if we have room for this entry
    if (availableChars - formattedEntry.length < 50) {
      // Keep some buffer
      if (entriesAdded < entries.length) {
        result += truncationNotice;
      }
      break;
    }

    result += formattedEntry;
    availableChars -= formattedEntry.length;
    entriesAdded++;
  }

  return result + footer;
}

/**
 * Calculates remaining character budget for a message.
 *
 * @param {string} currentMessage - The message built so far
 * @param {number} limit - Character limit (default: Discord's 2000)
 * @returns {number} - Remaining characters available
 */
function getRemainingChars(currentMessage, limit = DISCORD_MESSAGE_LIMIT) {
  return Math.max(0, limit - currentMessage.length);
}

/**
 * Creates a compact milestone celebration message that fits Discord limits.
 *
 * @param {Array} achievements - Array of milestone achievements
 * @param {Array} leaderboardData - Data for leaderboard display
 * @param {Object} options - Configuration options
 * @returns {string} - Formatted message within Discord limits
 */
function createMilestoneMessage(achievements, leaderboardData, options = {}) {
  const {
    title = "🎉 **MILESTONE ACHIEVED!**",
    funFacts = [],
    type = "download", // 'download' or 'upload'
    maxLeaderboardEntries = 10,
  } = options;

  let message = `${title}\n\n`;

  // Add achievements (these are the most important part)
  achievements.forEach((achievement) => {
    message += `${achievement.emoji} **${achievement.site.toUpperCase()}** `;
    message += `earned **"${achievement.achievement}"**!\n`;
    message += `**Total ${type === "upload" ? "Uploaded" : "Downloaded"}:** `;
    message += `${achievement.currentGB.toFixed(2)}GB (${achievement.label}+)\n\n`;
  });

  // Check remaining space for optional content
  let remainingChars = getRemainingChars(message);

  // Add a fun fact if there's room
  if (funFacts.length > 0 && remainingChars > 200) {
    const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    const factText = `💡 *${randomFact}*\n\n`;

    if (remainingChars >= factText.length + 100) {
      // Keep buffer for leaderboard
      message += factText;
      remainingChars = getRemainingChars(message);
    }
  }

  // Add leaderboard if there's room
  if (leaderboardData.length > 0 && remainingChars > 150) {
    const formatEntry = (entry, index) => {
      const medal =
        index === 0 ? "👑" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
      return `${medal} **${entry.site.toUpperCase()}**: ${entry.gb.toFixed(2)}GB\n`;
    };

    const leaderboard = truncateLeaderboard(
      leaderboardData.slice(0, maxLeaderboardEntries),
      remainingChars,
      formatEntry,
    );

    message += leaderboard;
  } else {
    // If no room for leaderboard, add a simple closing
    message += "🎊 *The journey continues!*";
  }

  // Final safety check
  return truncateMessage(message);
}

/**
 * Creates a daily winners message that fits Discord limits.
 *
 * @param {Object} champions - Object containing download, upload, and latency champions
 * @param {Object} leaderboards - Object containing sorted leaderboard data
 * @param {Array} funClosings - Array of fun closing messages
 * @returns {string} - Formatted message within Discord limits
 */
function createDailyWinnersMessage(champions, leaderboards, funClosings = []) {
  let message = `🏆 **DAILY PERFORMANCE CHAMPIONS** 🏆\n`;
  message += `*Celebrating today's networking superstars!*\n\n`;

  const { downloadChampion, uploadChampion, latencyChampion } = champions;
  const { downloadSorted, uploadSorted, latencySorted } = leaderboards;

  // Add champions (most important content)
  if (downloadChampion.site && downloadChampion.speed > 0) {
    const downloadMbps = ((downloadChampion.speed * 8) / 1000000).toFixed(2);
    message += `📥 **Download Champion** 🥇\n`;
    message += `**${downloadChampion.site.toUpperCase()}** achieved **${downloadMbps} Mbps**!\n\n`;
  }

  if (uploadChampion.site && uploadChampion.speed > 0) {
    const uploadMbps = ((uploadChampion.speed * 8) / 1000000).toFixed(2);
    message += `📤 **Upload Champion** 🥇\n`;
    message += `**${uploadChampion.site.toUpperCase()}** pushed **${uploadMbps} Mbps**!\n\n`;
  }

  if (latencyChampion.site && latencyChampion.latency < Infinity) {
    message += `⚡ **Latency Champion** 🥇\n`;
    message += `**${latencyChampion.site.toUpperCase()}** achieved **${latencyChampion.latency.toFixed(2)}ms**!\n\n`;
  }

  // Check remaining space for leaderboards
  let remainingChars = getRemainingChars(message);

  // Add abbreviated leaderboards if there's room
  if (remainingChars > 400) {
    message += `📊 **Daily Leaderboard:**\n\n`;

    // Add top 3 for each category
    const addTopEntries = (entries, title, unit, formatValue) => {
      let section = `${title}:\n`;
      const top3 = entries.slice(0, 3);
      top3.forEach((entry, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
        section += `${medal} **${entry.site.toUpperCase()}**: ${formatValue(entry)}${unit}\n`;
      });
      return section + "\n";
    };

    const leaderboardSection =
      addTopEntries(downloadSorted, "📥 Download", " Mbps", (e) =>
        e.speed.toFixed(2),
      ) +
      addTopEntries(uploadSorted, "📤 Upload", " Mbps", (e) =>
        e.speed.toFixed(2),
      ) +
      addTopEntries(latencySorted, "⚡ Latency", "ms", (e) =>
        e.latency.toFixed(2),
      );

    if (getRemainingChars(message + leaderboardSection) > 100) {
      message += leaderboardSection;
      remainingChars = getRemainingChars(message);
    }
  }

  // Add fun closing if there's room
  if (funClosings.length > 0 && remainingChars > 150) {
    const randomClosing =
      funClosings[Math.floor(Math.random() * funClosings.length)];
    const closingText = `🎊 **Congratulations!** 🎊\n*${randomClosing}*`;

    if (getRemainingChars(message + closingText) > 50) {
      message += closingText;
    }
  }

  return truncateMessage(message);
}

/**
 * Creates a cumulative milestone message that fits Discord limits.
 *
 * @param {number} currentMilestone - The milestone reached (in TB)
 * @param {Object} stats - Object containing download, upload, and total TB stats
 * @param {Array} milestoneMessages - Array of fun milestone messages
 * @returns {string} - Formatted message within Discord limits
 */
function createCumulativeMilestoneMessage(
  currentMilestone,
  stats,
  milestoneMessages = [],
) {
  const { downloadTB, uploadTB, totalTB } = stats;

  let message = `🎉 **MILESTONE ACHIEVED!** 🎉\n\n`;
  message += `🏆 **WE'VE CROSSED ${currentMilestone}TB OF TOTAL DATA!** 🏆\n\n`;

  message += `📊 **Current Stats:**\n`;
  message += `📥 **Downloaded:** ${downloadTB.toFixed(2)} TB\n`;
  message += `📤 **Uploaded:** ${uploadTB.toFixed(2)} TB\n`;
  message += `📈 **Grand Total:** ${totalTB.toFixed(2)} TB\n\n`;

  // Check remaining space for fun content
  let remainingChars = getRemainingChars(message);

  // Add fun fact if there's room
  if (milestoneMessages.length > 0 && remainingChars > 200) {
    const messageIndex = (currentMilestone - 1) % milestoneMessages.length;
    const funFact = milestoneMessages[messageIndex];
    const factText = `💡 *${funFact}*\n\n`;

    if (getRemainingChars(message + factText) > 150) {
      message += factText;
      remainingChars = getRemainingChars(message);
    }
  }

  // Add special milestone messages if there's room
  let specialMessage = "";
  if (currentMilestone === 1) {
    specialMessage = `🎊 **FIRST TERABYTE!** Welcome to the TB club! 🌟\n\n`;
  } else if (currentMilestone === 5) {
    specialMessage = `🔥 **5TB ACHIEVED!** You're officially data-addicted! 🚀\n\n`;
  } else if (currentMilestone === 10) {
    specialMessage = `💯 **DOUBLE DIGITS!** 10TB milestone reached! 🏠\n\n`;
  } else if (currentMilestone % 10 === 0) {
    specialMessage = `🎯 **${currentMilestone}TB MEGA MILESTONE!** Hall of fame! 👑\n\n`;
  }

  if (specialMessage && getRemainingChars(message + specialMessage) > 100) {
    message += specialMessage;
    remainingChars = getRemainingChars(message);
  }

  // Add progress and closing
  const nextMilestone = currentMilestone + 1;
  const progressTB = totalTB - currentMilestone;
  const progressPercent = (progressTB * 100).toFixed(1);

  const closing = `🎊 Keep pushing those bytes! Next: ${nextMilestone}TB!\n`;
  const progress = `📈 **Progress:** ${progressTB.toFixed(2)}TB (${progressPercent}%)`;

  if (getRemainingChars(message + closing + progress) > 50) {
    message += closing + progress;
  } else {
    message += `🎊 Next milestone: ${nextMilestone}TB!`;
  }

  return truncateMessage(message);
}

/**
 * Creates a time milestone message that fits Discord limits.
 *
 * @param {Object} currentMilestone - The milestone object with title, emoji, etc.
 * @param {Object} timeStats - Object containing time statistics
 * @param {Array} timeComparisons - Array of fun time comparison messages
 * @param {Array} closingMessages - Array of closing messages
 * @param {Object|null} nextMilestone - Next milestone info or null
 * @returns {string} - Formatted message within Discord limits
 */
function createTimeMilestoneMessage(
  currentMilestone,
  timeStats,
  timeComparisons = [],
  closingMessages = [],
  nextMilestone = null,
) {
  const { downloadHours, uploadHours, totalHours, totalDays } = timeStats;

  let message = `${currentMilestone.emoji} **TIME MILESTONE REACHED!** ${currentMilestone.emoji}\n\n`;
  message += `🏆 **We've unlocked the "${currentMilestone.title}"!** 🏆\n`;
  message += `*${currentMilestone.subtitle}*\n\n`;

  message += `⏱️ **The Statistics:**\n`;
  message += `📥 **Download Time:** ${downloadHours.toFixed(2)} hours\n`;
  message += `📤 **Upload Time:** ${uploadHours.toFixed(2)} hours\n`;
  message += `⏰ **Total Time:** **${totalHours.toFixed(2)} hours** (${totalDays.toFixed(2)} days)\n\n`;

  // Check remaining space for optional content
  let remainingChars = getRemainingChars(message);

  // Add time comparison if there's room
  if (timeComparisons.length > 0 && remainingChars > 200) {
    const randomComparison =
      timeComparisons[Math.floor(Math.random() * timeComparisons.length)];
    const comparisonText = `🤔 *Perspective: ${randomComparison}*\n\n`;

    if (getRemainingChars(message + comparisonText) > 150) {
      message += comparisonText;
      remainingChars = getRemainingChars(message);
    }
  }

  // Add closing message if there's room
  if (closingMessages.length > 0 && remainingChars > 100) {
    const randomClosing =
      closingMessages[Math.floor(Math.random() * closingMessages.length)];
    const closingText = `🎊 **Congratulations!** 🎊\n*${randomClosing}*\n\n`;

    if (getRemainingChars(message + closingText) > 80) {
      message += closingText;
      remainingChars = getRemainingChars(message);
    }
  }

  // Add next milestone teaser if there's room
  if (nextMilestone && remainingChars > 60) {
    const hoursToGo = nextMilestone.hours - totalHours;
    const nextText = `🎯 *Next: "${nextMilestone.title}" in ${hoursToGo.toFixed(1)} hours!*`;

    if (getRemainingChars(message + nextText) > 20) {
      message += nextText;
    }
  } else if (!nextMilestone && remainingChars > 40) {
    message += `🏆 *You've transcended time itself!*`;
  }

  return truncateMessage(message);
}

module.exports = {
  truncateMessage,
  truncateLeaderboard,
  getRemainingChars,
  createMilestoneMessage,
  createDailyWinnersMessage,
  createCumulativeMilestoneMessage,
  createTimeMilestoneMessage,
  DISCORD_MESSAGE_LIMIT,
};
