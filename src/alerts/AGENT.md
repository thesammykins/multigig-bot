# Alerts Directory - Agent Documentation

## Directory Purpose

This directory contains individual alert definition modules that define monitoring conditions and notification logic. Each file represents a single alert that the bot can execute on a scheduled basis.

## Alert Module Pattern

Every alert file must export an object with four required properties and one optional property:

```javascript
module.exports = {
  name: 'String - Human readable alert name',
  schedule: 'String - How often this alert should run (optional)',
  query: 'String - InfluxQL query to execute',
  condition: function(results) { /* return boolean */ },
  message: function(results) { /* return string */ }
};
```

## Required Exports



### `schedule` (String) - OPTIONAL
- **Purpose**: Defines how often this alert should run
- **Default**: If not specified, runs every minute
- **Formats**:
  - **Predefined**: `'daily'`, `'hourly'`, `'weekly'`, `'minute'`
  - **Time intervals**: `'5m'`, `'30s'`, `'2h'`, `'1d'`
    - `s` = seconds, `m` = minutes, `h` = hours, `d` = days
  - **Chaos scheduling**: `'chaos'`, `'chaos:15m'`, `'chaos:5m'`
    - Unpredictable timing with probability-based execution
- **Examples**:
  ```javascript
  schedule: 'daily',      // Once per day
  schedule: 'hourly',     // Once per hour
  schedule: '5m',         // Every 5 minutes
  schedule: '30s',        // Every 30 seconds
  schedule: '2h',         // Every 2 hours
  schedule: '1d',         // Every 1 day
  schedule: 'chaos',      // Unpredictable (default 15m checks)
  schedule: 'chaos:10m',  // Unpredictable with 10m check frequency
  ```
- **Use Cases**:
  - `'daily'` - Perfect for summary reports, awards, daily digests
  - `'hourly'` - Good for trend analysis, periodic checks
  - `'5m'` or `'10m'` - Standard monitoring alerts
  - `'30s'` or `'1m'` - Critical real-time monitoring
  - `'chaos'` - Status updates, fun alerts that benefit from unpredictability

## Test Mode and Example Alerts

### Test Mode Activation
Test mode can be activated by setting any of these environment variables:
- `TEST_MODE=true` - General test mode
- `TEST_WEBHOOK=true` - Webhook testing mode  
- `NODE_ENV=test` - Node test environment

### Example Alerts
The following alerts are **example/demonstration alerts** that only fire in test mode:
- `exampleAlert.js` - Basic webhook connectivity test
- `chaosExampleAlert.js` - Chaos scheduling demonstration
- `timeWastedChaoExample.js` - Example of converting regular alerts to chaos

**Production Safety**: Example alerts automatically check for test mode in their condition functions and will not trigger in production environments.

### Running Example Alerts
```bash
# Test webhook connectivity
TEST_WEBHOOK=true npm start

# Enable all test mode features
TEST_MODE=true npm start

# Test in development environment
NODE_ENV=test npm start
```

## Alert Properties

### `name` (String)
- **Purpose**: Human-readable identifier for the alert
- **Usage**: Used in logs and for debugging
- **Format**: Descriptive name explaining what the alert monitors
- **Example**: `'High CPU Usage Alert'`, `'Memory Threshold Exceeded'`

### `query` (String)
- **Purpose**: InfluxQL query to retrieve monitoring data
- **Requirements**: Must be valid InfluxQL syntax
- **Best Practices**:
  - Use appropriate time ranges (e.g., `WHERE time > now() - 5m`)
  - Group by relevant tags when needed
  - Use aggregate functions (mean, max, min) for better data analysis
  - Include proper retention policy if needed

### `condition` (Function)
- **Signature**: `(results: Array) => boolean`
- **Purpose**: Evaluates query results to determine if alert should fire
- **Return**: `true` to trigger notification, `false` to skip
- **Error Handling**: Should handle empty or malformed results gracefully
- **Example**:
  ```javascript
  condition: (results) => {
    if (!results || results.length === 0) return false;
    return results.some(r => r.cpu_usage > 80);
  }
  ```

### `message` (Function)
- **Signature**: `(results: Array) => string`
- **Purpose**: Generates the Discord notification message
- **Return**: String message to send to Discord webhook
- **Only Called**: When `condition` returns `true`
- **Formatting**: Should use Discord markdown for better readability
- **Example**:
  ```javascript
  message: (results) => {
    const alertingHosts = results.filter(r => r.cpu_usage > 80);
    return `**CPU Alert**: ${alertingHosts.length} hosts exceeded threshold`;
  }
  ```

## Development Guidelines for Agents

### Creating New Alerts

1. **File Naming**: Use descriptive names (e.g., `diskSpaceAlert.js`, `memoryUsageAlert.js`)
   - For example/demo alerts, include "Example" in the filename
   - Production alerts should not contain "Example" or "Test" in their names
2. **Test Mode Handling**: For example alerts, add test mode checks:
   ```javascript
   condition: (results) => {
     // Only trigger in test mode - this is an example alert
     const isTestMode =
       process.env.TEST_MODE === "true" ||
       process.env.TEST_WEBHOOK === "true" ||
       process.env.NODE_ENV === "test";

     if (!isTestMode) {
       return false;
     }

     // Your normal condition logic here...
   }
   ```
3. **Schedule Selection**: Choose appropriate schedule based on alert type:
   - **Real-time monitoring**: `'1m'`, `'30s'` for immediate detection
   - **Regular checks**: `'5m'`, `'10m'` for standard monitoring
   - **Periodic reports**: `'hourly'`, `'daily'` for summaries
   - **Weekly digests**: `'weekly'` for trend analysis
3. **Query Development**: Test queries in InfluxDB CLI before implementing
4. **Threshold Configuration**: Consider making thresholds configurable via config file
5. **Error Resilience**: Handle edge cases in both condition and message functions

### InfluxQL Best Practices

```javascript
// Good: Specific time range and aggregation
query: `SELECT mean("usage_percent") FROM "disk" WHERE time > now() - 1m GROUP BY "host"`

// Good: Proper field selection
query: `SELECT last("value") FROM "memory" WHERE "type"='used' AND time > now() - 30s`

// Avoid: Too broad time ranges that could cause performance issues
query: `SELECT * FROM "cpu" WHERE time > now() - 1d`
```

### Condition Function Patterns

```javascript
// Pattern 1: Threshold checking
condition: (results) => {
  if (!results?.length) return false;
  const threshold = 90;
  return results.some(r => r.usage > threshold);
}

// Pattern 2: Multiple criteria
condition: (results) => {
  if (!results?.length) return false;
  return results.some(r => r.cpu > 80 && r.memory > 70);
}

// Pattern 3: Rate of change
condition: (results) => {
  if (!results?.length >= 2) return false;
  const current = results[0].value;
  const previous = results[1].value;
  return (current - previous) > 50; // Alert if increase > 50
}
```

### Message Formatting Guidelines

- Use Discord markdown: `**bold**`, `*italic*`, `\`code\``
- Include relevant metrics and host information
- Keep messages concise but informative
- Use bullet points or tables for multiple items
- Include severity indicators when appropriate

```javascript
// Good message example with scheduling context
module.exports = {
  name: 'Disk Space Monitor',
  schedule: '10m', // Check every 10 minutes
  query: 'SELECT mean("usage_percent") FROM "disk" WHERE time > now() - 5m GROUP BY "host"',
  condition: (results) => results.some(r => r.usage > 80),
  message: (results) => {
    const critical = results.filter(r => r.usage > 95);
    const warning = results.filter(r => r.usage > 80 && r.usage <= 95);
    
    let msg = `**🚨 Disk Space Alert**\n\n`;
    
    if (critical.length > 0) {
      msg += `**Critical (>95%):**\n`;
      critical.forEach(r => msg += `- ${r.host}: ${r.usage.toFixed(1)}%\n`);
    }
    
    if (warning.length > 0) {
      msg += `**Warning (>80%):**\n`;
      warning.forEach(r => msg += `- ${r.host}: ${r.usage.toFixed(1)}%\n`);
    }
    
    return msg;
  }
};
```

## Testing Alert Modules

### Manual Testing
1. Test queries directly in InfluxDB
2. Mock result data to test condition logic
3. Verify message formatting in Discord

### Common Issues to Check
- Empty result sets
- Malformed data from InfluxDB
- Null or undefined values in results
- Query timeouts or errors
- Unicode/special characters in messages

## File Organization

### Naming Conventions
- Use camelCase for JavaScript files
- Include the monitored metric in the filename
- Be specific: `diskSpaceAlert.js` not `storageAlert.js`

### Categories
Consider organizing alerts by system type and schedule:

**Real-time Monitoring (30s - 5m):**
- `cpuUsageAlert.js` - Critical system performance
- `memoryUsageAlert.js` - Memory threshold breaches
- `diskSpaceAlert.js` - Storage critical alerts

**Regular Monitoring (5m - 30m):**
- `networkLatencyAlert.js` - Network performance checks
- `applicationErrorAlert.js` - Application health monitoring
- `serviceAvailabilityAlert.js` - Service uptime checks

**Periodic Reports (hourly - daily):**
- `dailyPerformanceSummary.js` - Daily system summaries
- `weeklyTrendReport.js` - Weekly trend analysis
- `monthlyCapacityReport.js` - Monthly capacity planning

## Integration Notes

- Alert modules are loaded automatically by `src/index.js`
- No need to register alerts manually
- Invalid alerts are logged but don't crash the application
- **Scheduling System**:
  - Global cron runs frequently (default: every minute)
  - Each alert runs according to its individual `schedule` property
  - Last run times are tracked in `config/lastRuns.json`
  - Alerts without `schedule` property default to every minute
  - System automatically prevents overlapping executions of the same alert

## Security Considerations

- Don't include sensitive data in alert queries
- Validate any user-controllable data in queries
- Be cautious with dynamic query construction
- **Rate Limiting**: Use appropriate schedules to prevent spam
  - Daily reports should use `'daily'` schedule
  - Critical alerts can use frequent schedules like `'1m'`
  - Balance monitoring needs with notification fatigue
- **Test Mode Safety**: Always implement test mode checks for example alerts to prevent production noise

## Schedule Examples by Use Case

```javascript
// Critical real-time monitoring
module.exports = {
  name: 'Critical CPU Alert',
  schedule: '30s', // Check every 30 seconds
  // ... rest of alert
};

// Standard monitoring
module.exports = {
  name: 'Memory Usage Alert', 
  schedule: '5m', // Check every 5 minutes
  // ... rest of alert
};

// Daily summary report
module.exports = {
  name: 'Daily Performance Summary',
  schedule: 'daily', // Once per day
  // ... rest of alert
};

// Custom interval
module.exports = {
  name: 'Custom Check',
  schedule: '2h', // Every 2 hours
  // ... rest of alert
};

// Chaos scheduling - unpredictable timing
module.exports = {
  name: 'Random Status Update',
  schedule: 'chaos', // Default unpredictable (15m checks)
  // ... rest of alert
};

// Chaos with custom check frequency
module.exports = {
  name: 'Chaotic Network Watcher',
  schedule: 'chaos:30m', // Unpredictable with 30m checks
  // ... rest of alert
};
```

## Chaos Scheduling

Chaos scheduling introduces controlled unpredictability to alert timing, perfect for status updates, fun alerts, or breaking predictable patterns.

### How It Works
- **Check Frequency**: Configurable interval for probability checks (default: 15 minutes)
- **Base Probability**: 5% chance to fire on each check
- **Time Multiplier**: Probability increases over time since last execution
- **Maximum Multiplier**: 3x after 3 hours (15% max chance)
- **Result**: Unpredictable timing averaging 1-4 hours between executions

### Chaos Schedule Options
```javascript
schedule: 'chaos',        // Default: 15m checks, 5-15% probability
schedule: 'chaos:5m',     // High frequency: 5m checks (more chaos)
schedule: 'chaos:30m',    // Low frequency: 30m checks (less chaos)
schedule: 'chaos:1h',     // Hourly checks (very unpredictable)
```

### Chaos Scheduling Best Practices
- **Perfect for**: Status updates, fun alerts, breaking monotony
- **Avoid for**: Critical alerts, time-sensitive notifications
- **State tracking**: Automatically handles persistent state across restarts
- **No code changes**: Works with existing condition/message functions
- **Debugging**: Check logs for chaos probability calculations

### Chaos Implementation Example
```javascript
module.exports = {
  name: 'Digital Sentinel Status',
  schedule: 'chaos:30m', // Check every 30 minutes, fire randomly
  query: 'SELECT COUNT(*) FROM "speedtest_result"',
  condition: (results) => {
    // Normal condition logic - chaos probability handled automatically
    return true; // Always trigger when chaos scheduler decides to fire
  },
  message: (results) => {
    return 'Surprise! The chaos scheduler struck again! 🎲';
  }
};
```

### Example Alert Template
```javascript
module.exports = {
  name: 'Example Alert - Test Only',
  schedule: 'chaos:15m',
  query: 'SELECT COUNT(*) FROM "speedtest_result"',
  condition: (results) => {
    // Test mode check for example alerts
    const isTestMode =
      process.env.TEST_MODE === "true" ||
      process.env.TEST_WEBHOOK === "true" ||
      process.env.NODE_ENV === "test";

    if (!isTestMode) {
      return false; // Never trigger in production
    }

    // Example condition logic
    return results && results.length > 0;
  },
  message: (results) => {
    return '🧪 **Example Alert Triggered** - This only fires in test mode!';
  }
};
```