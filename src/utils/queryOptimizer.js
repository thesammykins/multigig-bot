/**
 * Query Optimization Utility for Milestone Alerts
 *
 * This utility helps optimize database queries for milestone alerts by providing
 * smart time-based filtering while maintaining accuracy for cumulative calculations.
 *
 * Key features:
 * - Adaptive time windows based on data growth patterns
 * - Cache-friendly query patterns
 * - Performance monitoring and recommendations
 */

const fs = require('fs');
const path = require('path');

// Performance tracking file
const performanceTrackingFile = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV
  ? '/tmp/queryPerformance.json'
  : path.join(__dirname, '../../config/queryPerformance.json');

/**
 * Load query performance tracking data
 */
function loadPerformanceData() {
  try {
    const data = fs.readFileSync(performanceTrackingFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[DEBUG] No previous query performance data found, starting fresh');
    } else {
      console.warn(`[WARN] Failed to load query performance data: ${error.message}`);
    }
    return {
      queries: {},
      recommendations: {},
      lastOptimizationCheck: 0
    };
  }
}

/**
 * Save query performance tracking data
 */
function savePerformanceData(data) {
  try {
    const dir = path.dirname(performanceTrackingFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(performanceTrackingFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`[ERROR] Failed to save query performance data: ${error.message}`);
  }
}

/**
 * Track query execution time and provide optimization recommendations
 */
function trackQueryPerformance(alertName, queryType, executionTime, resultCount) {
  const perfData = loadPerformanceData();
  const now = Date.now();

  if (!perfData.queries[alertName]) {
    perfData.queries[alertName] = {
      executions: [],
      averageTime: 0,
      lastExecution: 0,
      resultGrowthRate: 0
    };
  }

  const alertData = perfData.queries[alertName];

  // Store execution data (keep last 50 executions)
  alertData.executions.push({
    timestamp: now,
    executionTime,
    resultCount,
    queryType
  });

  if (alertData.executions.length > 50) {
    alertData.executions = alertData.executions.slice(-50);
  }

  // Calculate average execution time
  const recentExecutions = alertData.executions.slice(-10);
  alertData.averageTime = recentExecutions.reduce((sum, exec) => sum + exec.executionTime, 0) / recentExecutions.length;
  alertData.lastExecution = now;

  // Calculate result growth rate (results per day)
  if (alertData.executions.length >= 2) {
    const oldest = alertData.executions[0];
    const newest = alertData.executions[alertData.executions.length - 1];
    const daysDiff = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60 * 24);
    const resultGrowth = newest.resultCount - oldest.resultCount;
    alertData.resultGrowthRate = daysDiff > 0 ? resultGrowth / daysDiff : 0;
  }

  // Generate recommendations
  generateOptimizationRecommendations(alertName, alertData, perfData);

  perfData.lastOptimizationCheck = now;
  savePerformanceData(perfData);
}

/**
 * Generate optimization recommendations based on performance data
 */
function generateOptimizationRecommendations(alertName, alertData, perfData) {
  const recommendations = [];

  // Check if query is getting slow
  if (alertData.averageTime > 5000) { // 5 seconds
    recommendations.push({
      type: 'SLOW_QUERY',
      severity: 'HIGH',
      message: `Alert "${alertName}" queries are averaging ${Math.round(alertData.averageTime)}ms. Consider query optimization.`,
      suggestion: 'Add time-based filtering or implement data archiving strategy.'
    });
  } else if (alertData.averageTime > 2000) { // 2 seconds
    recommendations.push({
      type: 'SLOW_QUERY',
      severity: 'MEDIUM',
      message: `Alert "${alertName}" queries are averaging ${Math.round(alertData.averageTime)}ms. Performance degradation detected.`,
      suggestion: 'Monitor query performance and consider optimization soon.'
    });
  }

  // Check data growth rate
  if (alertData.resultGrowthRate > 1000) { // More than 1000 new records per day
    recommendations.push({
      type: 'HIGH_GROWTH',
      severity: 'MEDIUM',
      message: `Alert "${alertName}" is processing ${Math.round(alertData.resultGrowthRate)} new records per day.`,
      suggestion: 'Consider implementing time-windowed queries to maintain performance.'
    });
  }

  // Store recommendations
  perfData.recommendations[alertName] = recommendations;
}

/**
 * Get optimized query with adaptive time window
 * This provides a balance between accuracy and performance
 */
function getOptimizedCumulativeQuery(baseQuery, alertName, estimatedDataAge = '90d') {
  const perfData = loadPerformanceData();
  const alertData = perfData.queries[alertName];

  // For new alerts or fast queries, use the base query
  if (!alertData || alertData.averageTime < 1000) {
    return baseQuery;
  }

  // For slower queries, add time windowing
  if (alertData.averageTime > 3000) {
    // Use a longer window for very slow queries
    const timeWindow = estimatedDataAge;
    console.log(`[INFO] Using optimized query with ${timeWindow} window for "${alertName}" (avg: ${Math.round(alertData.averageTime)}ms)`);

    // Add WHERE clause if not present
    if (baseQuery.toLowerCase().indexOf('where') === -1) {
      return baseQuery.replace('FROM "speedtest_result"', `FROM "speedtest_result" WHERE time > now() - ${timeWindow}`);
    }
  }

  return baseQuery;
}

/**
 * Get performance summary for monitoring
 */
function getPerformanceSummary() {
  const perfData = loadPerformanceData();
  const summary = {
    totalAlerts: Object.keys(perfData.queries).length,
    slowQueries: [],
    recommendations: [],
    averageQueryTime: 0
  };

  let totalTime = 0;
  let totalQueries = 0;

  Object.entries(perfData.queries).forEach(([alertName, data]) => {
    totalTime += data.averageTime;
    totalQueries++;

    if (data.averageTime > 2000) {
      summary.slowQueries.push({
        name: alertName,
        averageTime: Math.round(data.averageTime),
        lastExecution: new Date(data.lastExecution).toISOString()
      });
    }
  });

  summary.averageQueryTime = totalQueries > 0 ? Math.round(totalTime / totalQueries) : 0;

  // Collect all recommendations
  Object.entries(perfData.recommendations).forEach(([alertName, recs]) => {
    recs.forEach(rec => {
      summary.recommendations.push({
        alert: alertName,
        ...rec
      });
    });
  });

  return summary;
}

/**
 * Log performance summary to console (for monitoring)
 */
function logPerformanceSummary() {
  const summary = getPerformanceSummary();

  if (summary.totalAlerts === 0) {
    return;
  }

  console.log(`[PERF] Query Performance Summary:`);
  console.log(`[PERF] - Total alerts: ${summary.totalAlerts}`);
  console.log(`[PERF] - Average query time: ${summary.averageQueryTime}ms`);

  if (summary.slowQueries.length > 0) {
    console.log(`[PERF] - Slow queries (>2s): ${summary.slowQueries.length}`);
    summary.slowQueries.forEach(q => {
      console.log(`[PERF]   * ${q.name}: ${q.averageTime}ms`);
    });
  }

  if (summary.recommendations.length > 0) {
    console.log(`[PERF] - Active recommendations: ${summary.recommendations.length}`);
    summary.recommendations.forEach(rec => {
      if (rec.severity === 'HIGH') {
        console.log(`[PERF]   * [${rec.severity}] ${rec.alert}: ${rec.message}`);
      }
    });
  }
}

module.exports = {
  trackQueryPerformance,
  getOptimizedCumulativeQuery,
  getPerformanceSummary,
  logPerformanceSummary
};
