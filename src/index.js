const { WebhookClient } = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const InfluxDBService = require("./services/influxdb-http");
const config = require("../config/config.json");

// Enhanced logging system that sends errors to Discord
let alertWebhookClient; // Declared early for use in logging

// Store original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Rate limiting for Discord error notifications
let lastErrorTime = 0;
let errorCount = 0;
const ERROR_RATE_LIMIT_MS = 60000; // 1 minute
const MAX_ERRORS_PER_MINUTE = 5;

// Test mode detection
const isTestMode =
  process.env.TEST_MODE === "true" ||
  process.env.TEST_WEBHOOK === "true" ||
  process.env.TEST_ERROR_LOGGING === "true" ||
  process.env.NODE_ENV === "test";

// Enhanced console.error that also sends to Discord
console.error = function (...args) {
  // Call original console.error
  originalConsoleError.apply(console, args);

  // Send to Discord if it's an [ERROR] message and webhook is available
  const message = args.join(" ");
  const now = Date.now();

  // Reset error count if enough time has passed
  if (now - lastErrorTime > ERROR_RATE_LIMIT_MS) {
    errorCount = 0;
  }

  if (
    alertWebhookClient &&
    shouldSendErrorToDiscord(message) &&
    errorCount < MAX_ERRORS_PER_MINUTE
  ) {
    errorCount++;
    lastErrorTime = now;

    // Don't await to avoid blocking the error logging
    sendErrorToDiscord(message).catch((err) => {
      originalConsoleError(
        "[SYSTEM] Failed to send error to Discord:",
        err.message,
      );
    });
  } else if (errorCount >= MAX_ERRORS_PER_MINUTE) {
    // Send rate limit notification once
    if (errorCount === MAX_ERRORS_PER_MINUTE) {
      errorCount++;
      sendErrorToDiscord(
        "🚨 **ERROR RATE LIMIT REACHED** - Suppressing further error notifications for 1 minute to prevent spam",
        "RATE_LIMIT",
      ).catch(() => {});
    }
  }
};

// Enhanced console.warn for critical warnings
console.warn = function (...args) {
  // Call original console.warn
  originalConsoleWarn.apply(console, args);

  // Send critical warnings to Discord
  const message = args.join(" ");
  if (
    alertWebhookClient &&
    shouldSendWarningToDiscord(message) &&
    errorCount < MAX_ERRORS_PER_MINUTE
  ) {
    sendErrorToDiscord(message, "WARNING").catch((err) => {
      originalConsoleError(
        "[SYSTEM] Failed to send warning to Discord:",
        err.message,
      );
    });
  }
};

// Function to determine if error should be sent to Discord
function shouldSendErrorToDiscord(message) {
  const errorPatterns = [
    "[ERROR]",
    "Failed to",
    "Connection failed",
    "Timeout",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "500 Internal Server Error",
    "401 Unauthorized",
    "403 Forbidden",
    "404 Not Found",
    "Rate limited",
    "Webhook error",
    "Database error",
    "Critical",
    "Exception",
    "Stack trace",
  ];

  return errorPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// Function to determine if warning should be sent to Discord
function shouldSendWarningToDiscord(message) {
  const warningPatterns = [
    "[CRITICAL]",
    "CRITICAL",
    "File system is read-only",
    "Permission denied",
    "Configuration",
    "Security",
    "Authentication failed",
    "Certificate",
    "SSL",
  ];

  return warningPatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// Function to send error messages to Discord
async function sendErrorToDiscord(errorMessage, type = "ERROR") {
  if (!alertWebhookClient) return;

  try {
    let emoji, title;

    switch (type) {
      case "ERROR":
        emoji = "🚨";
        title = "SYSTEM ERROR";
        break;
      case "WARNING":
        emoji = "⚠️";
        title = "SYSTEM WARNING";
        break;
      case "RATE_LIMIT":
        emoji = "🛑";
        title = "RATE LIMIT";
        break;
      default:
        emoji = "❗";
        title = "SYSTEM NOTIFICATION";
    }

    // Clean up the error message for Discord
    const cleanMessage = errorMessage
      .replace(/\[ERROR\]/g, "")
      .replace(/\[WARN\]/g, "")
      .replace(/\[CRITICAL\]/g, "")
      .replace(/\[SYSTEM\]/g, "")
      .trim();

    // Truncate very long messages
    const truncatedMessage =
      cleanMessage.length > 1500
        ? cleanMessage.substring(0, 1500) + "... (truncated)"
        : cleanMessage;

    await alertWebhookClient.send({
      content:
        `${emoji} **${title}**\n\n` +
        `**Time**: ${new Date().toLocaleString()}\n` +
        `**Message**: ${truncatedMessage}\n` +
        `**Source**: MultiGig Bot Application` +
        (type === "RATE_LIMIT"
          ? `\n**Rate Limit**: ${errorCount - 1} errors in last minute`
          : ""),
      username: `System ${type === "RATE_LIMIT" ? "Monitor" : type.charAt(0) + type.slice(1).toLowerCase()}`,
    });
  } catch (webhookError) {
    // Use original console.error to avoid recursion
    originalConsoleError(
      "[SYSTEM] Failed to send error notification to Discord:",
      webhookError.message,
    );
  }
}

// Load configuration with environment variable overrides
const finalConfig = {
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || config.discord.webhookUrl,
    alertwebhookUrl:
      process.env.DISCORD_ALERT_WEBHOOK_URL || config.discord.alertwebhookUrl,
    botUsername: process.env.DISCORD_BOT_USERNAME || config.discord.botUsername,
    botAvatarUrl:
      process.env.DISCORD_BOT_AVATAR_URL || config.discord.botAvatarUrl,
  },
  influxdb: {
    host: process.env.INFLUXDB_HOST || config.influxdb.host,
    port: parseInt(process.env.INFLUXDB_PORT) || config.influxdb.port,
    protocol: process.env.INFLUXDB_PROTOCOL || config.influxdb.protocol,
    database: process.env.INFLUXDB_DATABASE || config.influxdb.database,
    username: process.env.INFLUXDB_USERNAME || config.influxdb.username,
    password: process.env.INFLUXDB_PASSWORD || config.influxdb.password,
    token: process.env.INFLUXDB_TOKEN || config.influxdb.token,
  },
  cronSchedule: process.env.CRON_SCHEDULE || config.cronSchedule,
};

// Initialize Discord Webhook Clients
const webhookClient = new WebhookClient({
  url: finalConfig.discord.webhookUrl,
});

alertWebhookClient = new WebhookClient({
  url: finalConfig.discord.alertwebhookUrl,
});

// Function to get the appropriate webhook for alerts based on test mode
function getAlertWebhookClient() {
  if (isTestMode) {
    console.log(
      "[INFO] TEST MODE: Redirecting celebration alerts to alertwebhookUrl",
    );
    return alertWebhookClient;
  }
  return webhookClient;
}

// Initialize InfluxDB Service
const influxDBService = new InfluxDBService(finalConfig.influxdb);

// File to track when each alert last ran
// Use /tmp for writable location in Docker, fallback to config for local development
const lastRunFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/lastRuns.json"
    : path.join(__dirname, "../config/lastRuns.json");

// Load/save last run times
function loadLastRuns() {
  try {
    console.log(`[DEBUG] Loading last run times from: ${lastRunFile}`);
    const data = fs.readFileSync(lastRunFile, "utf8");
    const lastRuns = JSON.parse(data);
    console.log(
      `[INFO] Loaded last run times for ${Object.keys(lastRuns).length} alerts`,
    );
    return lastRuns;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("[INFO] No previous run times found, starting fresh");
    } else {
      console.warn(`[WARN] Failed to load last run times: ${error.message}`);
    }
    return {};
  }
}

function saveLastRuns(lastRuns) {
  try {
    console.log(`[DEBUG] Saving last run times to: ${lastRunFile}`);

    // Ensure directory exists
    const dir = path.dirname(lastRunFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(lastRunFile, JSON.stringify(lastRuns, null, 2));
    console.log(
      `[DEBUG] Successfully saved last run times for ${Object.keys(lastRuns).length} alerts`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save last run times to ${lastRunFile}:`,
      error.message,
    );

    // Send error notification to alert webhook if this is a persistent issue
    if (error.code === "EROFS" || error.code === "EACCES") {
      console.error(
        "[ERROR] File system is read-only or permission denied - alerts may run more frequently than intended",
      );
    }
  }
}

// Parse schedule string to milliseconds
function parseSchedule(schedule) {
  if (!schedule) return 60000; // Default to 1 minute

  // Special handling for daily - return marker for time-based scheduling
  if (schedule === "daily") return "TIME_BASED_DAILY";

  // Predefined schedules (excluding daily which is handled above)
  const schedules = {
    hourly: 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    minute: 60 * 1000,
  };

  if (schedules[schedule]) return schedules[schedule];

  // Parse format like '5m', '2h', '30s', '1d'
  const match = schedule.match(/^(\d+)([smhd])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers = {
      s: 1000, // seconds
      m: 60 * 1000, // minutes
      h: 60 * 60 * 1000, // hours
      d: 24 * 60 * 60 * 1000, // days
    };
    return value * multipliers[unit];
  }

  console.warn(
    `[WARN] Invalid schedule format: ${schedule}. Using default 1 minute.`,
  );
  return 60000; // Default to 1 minute
}

// Get current date string in timezone for daily alert tracking
function getCurrentDateInTimezone(timezone) {
  const now = new Date();
  const options = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  return now.toLocaleDateString("en-CA", options); // YYYY-MM-DD format
}

// Check if it's currently the daily alert hour in the configured timezone
function isCurrentlyDailyAlertHour(timezone, targetHour) {
  const now = new Date();
  const options = {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  };
  const currentHour = parseInt(now.toLocaleString("en-US", options));
  return currentHour === targetHour;
}

// Check if alert should run based on its schedule
function shouldRunAlert(alert, lastRuns, config) {
  const alertName = alert.name;
  const scheduleResult = parseSchedule(alert.schedule);

  // Handle time-based daily alerts
  if (scheduleResult === "TIME_BASED_DAILY") {
    const timezone = config.timezone || "America/New_York";
    const dailyAlertHour = config.dailyAlertHour || 9;

    // Check if it's currently the target hour
    if (!isCurrentlyDailyAlertHour(timezone, dailyAlertHour)) {
      return false;
    }

    // Check if we already ran today
    const today = getCurrentDateInTimezone(timezone);
    const lastRunDate = lastRuns[alertName];

    if (lastRunDate === today) {
      return false; // Already ran today
    }

    return true; // Time to run daily alert
  }

  // Handle interval-based alerts (existing logic)
  const now = Date.now();
  const lastRun = lastRuns[alertName] || 0;
  const scheduleMs = scheduleResult;

  return now - lastRun >= scheduleMs;
}

// Load alerts from the alerts directory
const alerts = [];
const alertsDir = path.join(__dirname, "alerts");

fs.readdirSync(alertsDir)
  .filter((file) => file.endsWith(".js"))
  .forEach((file) => {
    try {
      const alert = require(path.join(alertsDir, file));
      // Basic validation to ensure the alert has the required properties
      if (alert.name && alert.query && alert.condition && alert.message) {
        alerts.push(alert);
        const scheduleInfo = alert.schedule
          ? ` (schedule: ${alert.schedule})`
          : " (schedule: default 1m)";
        console.log(`[INFO] Loaded alert: ${alert.name}${scheduleInfo}`);
      } else {
        console.warn(
          `[WARN] The file ${file} is not a valid alert module. It's missing required exports.`,
        );
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load alert from ${file}:`, error);
    }
  });

console.log(`[INFO] Successfully loaded ${alerts.length} alerts.`);

// Log file system information for debugging
console.log(`[DEBUG] Runtime state file location: ${lastRunFile}`);
console.log(`[DEBUG] Docker environment: ${process.env.DOCKER_ENV || "false"}`);
console.log(
  `[DEBUG] Node environment: ${process.env.NODE_ENV || "development"}`,
);

// Check if we can write to the target directory
try {
  const dir = path.dirname(lastRunFile);
  console.log(`[DEBUG] Target directory: ${dir}`);

  // Test directory access
  fs.accessSync(dir, fs.constants.F_OK);
  console.log(`[DEBUG] Directory exists: ${dir}`);

  // Test write permissions
  fs.accessSync(dir, fs.constants.W_OK);
  console.log(`[DEBUG] Directory is writable: ${dir}`);
} catch (error) {
  console.warn(
    `[WARN] Directory access issue for ${path.dirname(lastRunFile)}: ${error.message}`,
  );
}

// Send startup notification to alert webhook
(async () => {
  try {
    await alertWebhookClient.send({
      content:
        `🟢 **MultiGig Bot Started Successfully**\n\n` +
        `📊 **Status**: Bot is now online and monitoring\n` +
        `🔔 **Alerts Loaded**: ${alerts.length} alert(s)\n` +
        `⏰ **Schedule**: ${finalConfig.cronSchedule || "* * * * *"}\n` +
        `🏥 **Health**: All systems operational\n` +
        `📝 **Error Logging**: All [ERROR] messages will be sent to this channel\n` +
        `🛡️ **Rate Limiting**: Maximum ${MAX_ERRORS_PER_MINUTE} error notifications per minute\n` +
        (isTestMode
          ? `🧪 **TEST MODE**: Celebration alerts will also be sent to this channel`
          : `🎉 **Celebration Alerts**: Sent to main webhook channel`),
      username: isTestMode ? "[TEST] System Status" : "System Status",
    });

    // Test error logging system (only in test mode)
    if (process.env.TEST_ERROR_LOGGING === "true") {
      console.log("[INFO] Testing error logging system...");
      setTimeout(() => {
        console.error(
          "[ERROR] Test error message - this should appear in Discord",
        );
      }, 2000);
      setTimeout(() => {
        console.warn(
          "[CRITICAL] Test critical warning - this should also appear in Discord",
        );
      }, 4000);
    }
  } catch (error) {
    console.error(
      `[ERROR] Failed to send startup notification: ${error.message}`,
    );
  }
})();

// Load last run times
let lastRuns = loadLastRuns();

// Schedule a cron job to run checks frequently
// Individual alerts will only run based on their own schedule
cron.schedule(finalConfig.cronSchedule || "* * * * *", async () => {
  console.log("[INFO] Running scheduled alert checks...");

  let needToSaveLastRuns = false;

  for (const alert of alerts) {
    try {
      // Check if this alert should run based on its schedule
      if (!shouldRunAlert(alert, lastRuns, finalConfig)) {
        const scheduleResult = parseSchedule(alert.schedule);

        if (scheduleResult === "TIME_BASED_DAILY") {
          const timezone = finalConfig.timezone || "America/New_York";
          const dailyAlertHour = finalConfig.dailyAlertHour || 9;
          console.log(
            `[INFO] Skipping ${alert.name} - daily alert scheduled for ${dailyAlertHour}:00 ${timezone}`,
          );
        } else {
          const lastRun = lastRuns[alert.name] || 0;
          const nextRun = new Date(lastRun + scheduleResult);
          console.log(
            `[INFO] Skipping ${alert.name} - next run scheduled for ${nextRun.toLocaleString()}`,
          );
        }
        continue;
      }

      console.log(`[INFO] Executing query for alert: ${alert.name}`);

      // Try to execute the database query, but allow alerts to proceed even if it fails
      let results = null;
      try {
        results = await influxDBService.query(alert.query);
      } catch (queryError) {
        console.error(
          `[ERROR] Failed to execute InfluxDB query for ${alert.name}:`,
          queryError.message || queryError,
        );
        console.log(
          `[INFO] Continuing with alert logic despite database error...`,
        );

        // Send database error notification to alert webhook
        try {
          await alertWebhookClient.send({
            content:
              `⚠️ **Database Error**\n\n` +
              `**Alert**: ${alert.name}\n` +
              `**Error**: ${queryError.message || queryError}\n` +
              `**Status**: Alert logic continuing with null data`,
            username: "Database Alert",
          });
        } catch (systemError) {
          console.error(
            `[ERROR] Failed to send database error notification: ${systemError.message}`,
          );
        }
      }

      // The condition function determines if a notification should be sent
      // It receives the results (which may be null if database query failed)
      if (alert.condition(results)) {
        const message = alert.message(results);
        console.log(
          `[INFO] Condition met for ${alert.name}. Sending notification.`,
        );

        try {
          const targetWebhook = getAlertWebhookClient();
          const usernamePrefix = isTestMode ? "[TEST] " : "";

          await targetWebhook.send({
            content: isTestMode ? `🧪 **TEST MODE**\n\n${message}` : message,
            username:
              usernamePrefix +
              (finalConfig.discord.botUsername || "MultiGig Alerter"),
            avatarURL: finalConfig.discord.botAvatarUrl || "",
          });

          console.log(
            `[INFO] Alert notification sent for ${alert.name}${isTestMode ? " (TEST MODE)" : ""}.`,
          );
        } catch (webhookError) {
          console.error(
            `[ERROR] Failed to send webhook for ${alert.name}:`,
            webhookError.message || webhookError,
          );

          // Try to send error notification to alert webhook
          try {
            await alertWebhookClient.send({
              content: `⚠️ **System Error**: Failed to send alert "${alert.name}" to main channel. Error: ${webhookError.message}`,
              username: "System Alert",
            });
          } catch (systemError) {
            console.error(
              `[ERROR] Failed to send system error notification: ${systemError.message}`,
            );
          }
        }
      } else {
        console.log(`[INFO] Condition not met for alert: ${alert.name}.`);
      }

      // Update last run time for this alert
      const scheduleResult = parseSchedule(alert.schedule);
      if (scheduleResult === "TIME_BASED_DAILY") {
        // For daily alerts, store the date instead of timestamp
        const timezone = finalConfig.timezone || "America/New_York";
        lastRuns[alert.name] = getCurrentDateInTimezone(timezone);
      } else {
        // For interval alerts, store timestamp as before
        lastRuns[alert.name] = Date.now();
      }
      needToSaveLastRuns = true;
    } catch (error) {
      console.error(
        `[ERROR] Unexpected error processing alert ${alert.name}:`,
        error,
      );

      // Send critical error notification to alert webhook
      try {
        await alertWebhookClient.send({
          content:
            `🚨 **Critical Alert Error**\n\n` +
            `**Alert**: ${alert.name}\n` +
            `**Error**: ${error.message || error}\n` +
            `**Status**: Alert processing failed - please investigate`,
          username: "Critical System Alert",
        });
      } catch (systemError) {
        console.error(
          `[ERROR] Failed to send critical error notification: ${systemError.message}`,
        );
      }

      // Still update last run time to prevent spam on persistent errors
      const scheduleResult = parseSchedule(alert.schedule);
      if (scheduleResult === "TIME_BASED_DAILY") {
        // For daily alerts, store the date instead of timestamp
        const timezone = finalConfig.timezone || "America/New_York";
        lastRuns[alert.name] = getCurrentDateInTimezone(timezone);
      } else {
        // For interval alerts, store timestamp as before
        lastRuns[alert.name] = Date.now();
      }
      needToSaveLastRuns = true;
    }
  }

  // Save last run times if any alerts ran
  if (needToSaveLastRuns) {
    saveLastRuns(lastRuns);
  }
});

console.log(
  `[INFO] Bot started. Global cron schedule: "${finalConfig.cronSchedule || "* * * * *"}"`,
);
console.log(`[INFO] Each alert will run according to its individual schedule.`);
console.log(
  `[INFO] Error logging to Discord: ENABLED (${MAX_ERRORS_PER_MINUTE} errors/minute max)`,
);
if (isTestMode) {
  console.log(
    `[INFO] TEST MODE: ENABLED - All celebration alerts will be sent to alertwebhookUrl`,
  );
  console.log(
    `[INFO] TEST MODE: Main webhook (celebrations) -> Alert webhook (testing)`,
  );
  console.log(
    `[INFO] TEST MODE: Error notifications -> Alert webhook (normal)`,
  );
}
if (process.env.TEST_ERROR_LOGGING === "true") {
  console.log(`[INFO] Error logging test mode: ENABLED`);
}

// Handle process errors and send notifications to alert webhook
process.on("uncaughtException", async (error) => {
  console.error("[ERROR] Uncaught Exception:", error);
  try {
    await alertWebhookClient.send({
      content:
        `🚨 **CRITICAL SYSTEM ERROR**\n\n` +
        `**Type**: Uncaught Exception\n` +
        `**Error**: ${error.message}\n` +
        `**Status**: Bot may be unstable - immediate attention required`,
      username: "CRITICAL ALERT",
    });
  } catch (webhookError) {
    console.error(
      "[ERROR] Failed to send critical error notification:",
      webhookError,
    );
  }
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("[ERROR] Unhandled Rejection at:", promise, "reason:", reason);
  try {
    await alertWebhookClient.send({
      content:
        `⚠️ **System Warning**\n\n` +
        `**Type**: Unhandled Promise Rejection\n` +
        `**Reason**: ${reason}\n` +
        `**Status**: Bot continuing but may have issues`,
      username: "System Warning",
    });
  } catch (webhookError) {
    console.error("[ERROR] Failed to send warning notification:", webhookError);
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[INFO] Shutting down bot...");

  // Send shutdown notification
  try {
    await alertWebhookClient.send({
      content:
        `🔴 **MultiGig Bot Shutting Down**\n\n` +
        `**Status**: Bot is going offline\n` +
        `**Reason**: Manual shutdown or restart\n` +
        `**Time**: ${new Date().toLocaleString()}\n` +
        `📝 **Note**: Error logging to Discord is now disabled`,
      username: "System Status",
    });
  } catch (error) {
    // Use original console.error to avoid Discord notification during shutdown
    originalConsoleError(
      `[ERROR] Failed to send shutdown notification: ${error.message}`,
    );
  }

  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  webhookClient.destroy();
  alertWebhookClient.destroy();
  process.exit(0);
});
