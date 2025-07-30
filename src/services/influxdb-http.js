const axios = require("axios");
const { trackQueryPerformance } = require("../utils/queryOptimizer");

/**
 * HTTP-based InfluxDB service that uses direct REST API calls
 * This service works around issues with the influx library's time precision handling
 */
class InfluxDBHTTPService {
  /**
   * Initializes the HTTP-based InfluxDB client.
   * @param {object} config - The InfluxDB configuration object.
   * @param {string} config.host - The InfluxDB host.
   * @param {number} config.port - The InfluxDB port.
   * @param {string} config.protocol - The protocol to use (e.g., 'https').
   * @param {string} config.database - The name of the database.
   * @param {string} [config.username] - The username for authentication.
   * @param {string} [config.password] - The password for authentication.
   * @param {string} [config.token] - The API token for authentication.
   */
  constructor(config) {
    if (!config || !config.host || !config.database) {
      throw new Error(
        "[ERROR] InfluxDB configuration is missing required fields (host, database).",
      );
    }

    this.config = config;
    this.baseURL = `${config.protocol}://${config.host}:${config.port}`;

    // Set up authentication
    this.authParams = {};
    this.authHeaders = {
      Accept: "application/json",
    };

    if (config.token) {
      console.log(
        "[INFO] Using token authentication for InfluxDB HTTP service",
      );
      this.authParams.u = "token";
      this.authParams.p = config.token;
    } else if (config.username && config.password) {
      console.log(
        "[INFO] Using username/password authentication for InfluxDB HTTP service",
      );
      this.authParams.u = config.username;
      this.authParams.p = config.password;
    } else {
      console.log("[INFO] Using no authentication for InfluxDB HTTP service");
    }
  }

  /**
   * Executes an InfluxQL query using HTTP REST API with performance tracking.
   * @param {string} query - The InfluxQL query string to execute.
   * @param {string} alertName - Optional alert name for performance tracking.
   * @returns {Promise<any>} A promise that resolves with the query results.
   */
  async query(query, alertName = "unknown") {
    const startTime = Date.now();
    try {
      const url = `${this.baseURL}/query`;

      const params = {
        db: this.config.database,
        q: query,
        ...this.authParams,
      };

      console.log(`[DEBUG] Executing HTTP query: ${query}`);

      const response = await axios.get(url, {
        params: params,
        headers: this.authHeaders,
        timeout: 30000, // 30 second timeout
      });

      // Parse InfluxDB response format
      const results = this.parseInfluxDBResponse(response.data);

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

      console.log(`[DEBUG] Query returned ${results.length} results`);
      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error.response) {
        // Server responded with error status
        const errorMsg = `HTTP ${error.response.status} ${error.response.statusText}`;
        const errorData = error.response.data;
        console.error(`[ERROR] InfluxDB HTTP query failed: ${errorMsg}`);
        if (errorData) {
          console.error(`[ERROR] Response data: ${JSON.stringify(errorData)}`);
          throw new Error(`InfluxDB query failed: ${errorMsg} - ${errorData}`);
        }
        throw new Error(`InfluxDB query failed: ${errorMsg}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error(
          `[ERROR] No response from InfluxDB server: ${error.message}`,
        );
        throw new Error(`InfluxDB connection failed: ${error.message}`);
      } else {
        // Something else happened
        console.error(`[ERROR] InfluxDB query error: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Parses InfluxDB HTTP API response format into a more usable format.
   * @param {object} responseData - Raw response data from InfluxDB HTTP API
   * @returns {Array} Parsed results array
   */
  parseInfluxDBResponse(responseData) {
    if (!responseData || !responseData.results) {
      return [];
    }

    const results = [];

    for (const result of responseData.results) {
      if (result.error) {
        throw new Error(`InfluxDB query error: ${result.error}`);
      }

      if (!result.series) {
        continue;
      }

      for (const series of result.series) {
        const { name, columns, values, tags } = series;

        if (!values) {
          continue;
        }

        for (const valueRow of values) {
          const record = {};

          // Add time field
          if (columns[0] === "time" && valueRow[0]) {
            record.time = new Date(valueRow[0]);
          }

          // Add data fields
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const value = valueRow[i];

            if (value !== null && value !== undefined) {
              record[column] = value;
            }
          }

          // Add tags
          if (tags) {
            Object.assign(record, tags);
          }

          // Add measurement name
          if (name) {
            record._measurement = name;
          }

          results.push(record);
        }
      }
    }

    console.log(
      `[DEBUG] Parsed ${results.length} records from InfluxDB response`,
    );
    return results;
  }

  /**
   * Test the connection to InfluxDB
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      await this.query('SELECT COUNT(*) FROM "speedtest_result" LIMIT 1');
      return true;
    } catch (error) {
      console.error(`[ERROR] Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get available measurements in the database
   * @returns {Promise<Array>} Array of measurement names
   */
  async getMeasurements() {
    try {
      const results = await this.query("SHOW MEASUREMENTS");
      return results.map((r) => r.name).filter(Boolean);
    } catch (error) {
      console.error(`[ERROR] Failed to get measurements: ${error.message}`);
      return [];
    }
  }

  /**
   * Get field keys for a measurement
   * @param {string} measurement - Name of the measurement
   * @returns {Promise<Array>} Array of field information
   */
  async getFields(measurement) {
    try {
      const results = await this.query(`SHOW FIELD KEYS FROM "${measurement}"`);
      return results;
    } catch (error) {
      console.error(
        `[ERROR] Failed to get fields for ${measurement}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get tag keys for a measurement
   * @param {string} measurement - Name of the measurement
   * @returns {Promise<Array>} Array of tag keys
   */
  async getTags(measurement) {
    try {
      const results = await this.query(`SHOW TAG KEYS FROM "${measurement}"`);
      return results.map((r) => r.tagKey).filter(Boolean);
    } catch (error) {
      console.error(
        `[ERROR] Failed to get tags for ${measurement}: ${error.message}`,
      );
      return [];
    }
  }
}

module.exports = InfluxDBHTTPService;
