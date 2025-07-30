const { InfluxDB } = require("influx");
const { trackQueryPerformance } = require("../utils/queryOptimizer");

/**
 * Service class for interacting with InfluxDB.
 */
class InfluxDBService {
  /**
   * Initializes the InfluxDB client.
   * @param {object} config - The InfluxDB configuration object.
   * @param {string} config.host - The InfluxDB host.
   * @param {number} config.port - The InfluxDB port.
   * @param {string} config.protocol - The protocol to use (e.g., 'http').
   * @param {string} config.database - The name of the database.
   * @param {string} [config.username] - The username for authentication.
   * @param {string} [config.password] - The password for authentication.
   * @param {string} [config.token] - The API token for authentication (alternative to username/password).
   */
  constructor(config) {
    if (!config || !config.host || !config.database) {
      throw new Error(
        "[ERROR] InfluxDB configuration is missing required fields (host, database).",
      );
    }

    // If token is provided, use it with "token" as username
    let username = config.username;
    let password = config.password;

    if (config.token) {
      console.log("[INFO] Using token authentication for InfluxDB");
      username = "token";
      password = config.token;
    } else if (config.username && config.password) {
      console.log("[INFO] Using username/password authentication for InfluxDB");
    } else {
      console.log("[INFO] Using no authentication for InfluxDB");
    }

    this.influx = new InfluxDB({
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      database: config.database,
      username: username,
      password: password,
      precision: "ms", // Set default time precision to milliseconds
    });
  }

  /**
   * Executes an InfluxQL query with performance tracking.
   * @param {string} query - The InfluxQL query string to execute.
   * @param {string} alertName - Optional alert name for performance tracking.
   * @returns {Promise<any>} A promise that resolves with the query results.
   */
  async query(query, alertName = "unknown") {
    const startTime = Date.now();

    try {
      const results = await this.influx.query(query);

      // Track query performance
      const executionTime = Date.now() - startTime;
      const resultCount = Array.isArray(results) ? results.length : 0;

      trackQueryPerformance(alertName, "query", executionTime, resultCount);

      // Log slow queries
      if (executionTime > 2000) {
        console.warn(
          `[PERF] Slow query detected for "${alertName}": ${executionTime}ms (${resultCount} results)`,
        );
      }

      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      console.error(
        `[ERROR] Failed to execute InfluxDB query for "${alertName}" after ${executionTime}ms. Error: ${error.message}`,
      );

      // Track failed queries too
      trackQueryPerformance(alertName, "failed_query", executionTime, 0);

      // Depending on the desired behavior, you might want to handle this more gracefully.
      // For now, we re-throw to let the caller handle it.
      throw error;
    }
  }
}

module.exports = InfluxDBService;
