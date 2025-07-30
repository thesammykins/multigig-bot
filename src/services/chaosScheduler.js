const fs = require("fs");
const path = require("path");

/**
 * Chaos Scheduler Service
 *
 * Provides unpredictable scheduling for alerts using probability-based timing.
 * Any alert can use chaos scheduling by setting schedule to "chaos" or "chaos:15m".
 *
 * Features:
 * - Base 5% chance that increases over time since last execution
 * - Multiplier caps at 3x after 3 hours (configurable)
 * - Persistent state tracking across bot restarts
 * - Configurable check frequencies
 * - Works with existing alert system
 *
 * Usage:
 * const chaosScheduler = require('./services/chaosScheduler');
 *
 * In alert file:
 * schedule: "chaos",        // Uses default 15m check frequency
 * schedule: "chaos:5m",     // Custom 5 minute check frequency
 * schedule: "chaos:30s",    // Custom 30 second check frequency
 */

class ChaosScheduler {
  constructor() {
    // File to track chaos scheduling state
    this.stateFile = process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
      ? "/tmp/chaosSchedulerState.json"
      : path.join(__dirname, "../../config/chaosSchedulerState.json");

    // Chaos scheduling configuration
    this.config = {
      defaultCheckInterval: "15m",  // Default check frequency
      baseChance: 0.05,            // 5% base chance
      maxMultiplier: 3,            // Maximum multiplier (3x)
      maxMultiplierTime: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
    };

    this.state = this.loadState();
  }

  /**
   * Load chaos scheduling state from persistent storage
   * @returns {Object} State object with lastExecutions
   */
  loadState() {
    try {
      const data = fs.readFileSync(this.stateFile, "utf8");
      const state = JSON.parse(data);
      console.log(`[DEBUG] Loaded chaos scheduler state: ${Object.keys(state.lastExecutions || {}).length} alerts tracked`);
      return state;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("[DEBUG] No previous chaos scheduler state found, starting fresh");
      } else {
        console.warn(`[WARN] Failed to load chaos scheduler state: ${error.message}`);
      }
      return { lastExecutions: {} };
    }
  }

  /**
   * Save chaos scheduling state to persistent storage
   * @param {Object} state - State object to save
   */
  saveState(state = this.state) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
      console.log(`[DEBUG] Saved chaos scheduler state for ${Object.keys(state.lastExecutions || {}).length} alerts`);
    } catch (error) {
      console.error(`[ERROR] Failed to save chaos scheduler state to ${this.stateFile}:`, error.message);

      if (error.code === "EROFS" || error.code === "EACCES") {
        console.error("[ERROR] File system is read-only or permission denied - chaos scheduling may repeat");
      }
    }
  }

  /**
   * Parse chaos schedule string into check interval
   * @param {string} schedule - Schedule string like "chaos" or "chaos:15m"
   * @returns {number} Check interval in milliseconds
   */
  parseChaosSchedule(schedule) {
    if (schedule === "chaos") {
      return this.parseTimeInterval(this.config.defaultCheckInterval);
    }

    // Extract custom interval from "chaos:15m" format
    const match = schedule.match(/^chaos:(.+)$/);
    if (match) {
      return this.parseTimeInterval(match[1]);
    }

    console.warn(`[WARN] Invalid chaos schedule format: ${schedule}. Using default.`);
    return this.parseTimeInterval(this.config.defaultCheckInterval);
  }

  /**
   * Parse time interval string into milliseconds
   * @param {string} interval - Time interval like "15m", "30s", "2h"
   * @returns {number} Interval in milliseconds
   */
  parseTimeInterval(interval) {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers = {
        s: 1000,                    // seconds
        m: 60 * 1000,              // minutes
        h: 60 * 60 * 1000,         // hours
        d: 24 * 60 * 60 * 1000,    // days
      };
      return value * multipliers[unit];
    }

    console.warn(`[WARN] Invalid time interval format: ${interval}. Using default 15m.`);
    return 15 * 60 * 1000; // 15 minutes default
  }

  /**
   * Check if a chaos-scheduled alert should run based on probability
   * @param {string} alertName - Name of the alert
   * @returns {boolean} True if alert should run
   */
  shouldChaosAlertRun(alertName) {
    const now = Date.now();
    const lastExecution = this.state.lastExecutions[alertName] || 0;
    const timeSinceLastExecution = now - lastExecution;

    // Calculate probability based on time elapsed
    const timeMultiplier = Math.min(
      timeSinceLastExecution / this.config.maxMultiplierTime,
      this.config.maxMultiplier
    );

    const currentChance = this.config.baseChance * Math.max(1, timeMultiplier);
    const shouldRun = Math.random() < currentChance;

    // Debug logging for chaos scheduling decisions
    const hoursElapsed = (timeSinceLastExecution / (60 * 60 * 1000)).toFixed(2);
    const chancePercent = (currentChance * 100).toFixed(1);

    console.log(`[DEBUG] Chaos check for "${alertName}": ${hoursElapsed}h elapsed, ${chancePercent}% chance, ${shouldRun ? 'FIRE' : 'skip'}`);

    return shouldRun;
  }

  /**
   * Record that a chaos-scheduled alert has been executed
   * @param {string} alertName - Name of the alert that executed
   */
  recordChaosExecution(alertName) {
    this.state.lastExecutions[alertName] = Date.now();
    this.saveState();

    console.log(`[INFO] Recorded chaos execution for "${alertName}"`);
  }

  /**
   * Check if a schedule string indicates chaos scheduling
   * @param {string} schedule - Schedule string from alert
   * @returns {boolean} True if this is a chaos schedule
   */
  isChaosSchedule(schedule) {
    return schedule && (schedule === "chaos" || schedule.startsWith("chaos:"));
  }

  /**
   * Get the check interval for a chaos schedule
   * @param {string} schedule - Chaos schedule string
   * @returns {number} Check interval in milliseconds
   */
  getChaosCheckInterval(schedule) {
    return this.parseChaosSchedule(schedule);
  }

  /**
   * Create a wrapped condition function for chaos scheduling
   * This is a convenience method for alerts that want to easily adopt chaos scheduling
   * @param {Function} originalCondition - Original alert condition function
   * @param {string} alertName - Name of the alert
   * @returns {Function} Wrapped condition function that includes chaos probability
   */
  createChaosCondition(originalCondition, alertName) {
    return (results) => {
      // First check if the chaos scheduler says we should run
      if (!this.shouldChaosAlertRun(alertName)) {
        return false;
      }

      // If chaos scheduler says yes, run the original condition
      const shouldRun = originalCondition(results);

      // If both chaos and original condition agree, record the execution
      if (shouldRun) {
        this.recordChaosExecution(alertName);
      }

      return shouldRun;
    };
  }

  /**
   * Get statistics about chaos scheduling state
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = Date.now();
    const executions = Object.entries(this.state.lastExecutions).map(([name, time]) => ({
      alertName: name,
      lastExecution: time,
      hoursAgo: ((now - time) / (60 * 60 * 1000)).toFixed(2),
      currentChance: Math.min(
        this.config.baseChance * Math.max(1, (now - time) / this.config.maxMultiplierTime),
        this.config.baseChance * this.config.maxMultiplier
      )
    }));

    return {
      totalChaosAlerts: executions.length,
      executions: executions.sort((a, b) => b.lastExecution - a.lastExecution),
      config: this.config
    };
  }

  /**
   * Reset chaos scheduling state for an alert (useful for testing)
   * @param {string} alertName - Name of alert to reset, or null for all
   */
  resetChaosState(alertName = null) {
    if (alertName) {
      delete this.state.lastExecutions[alertName];
      console.log(`[INFO] Reset chaos state for "${alertName}"`);
    } else {
      this.state.lastExecutions = {};
      console.log("[INFO] Reset all chaos scheduling state");
    }
    this.saveState();
  }
}

// Export singleton instance
module.exports = new ChaosScheduler();
