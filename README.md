# MultiGig Bot - InfluxDB Alerter for Discord

MultiGig Bot is a lightweight, extensible Node.js application designed to query an InfluxDB database, check for specific conditions, and send notifications to a Discord channel via webhooks. It's built to be easily configurable and allows for the simple creation of new alerts without needing to modify the core application logic.

It was built with the goal of alerting a small group of individuals who are part of the NBN Multigig trial to celebrate milestones and get tiny little discord webhook awards when they were reached, this project is frankly useless to anyone who isn't following the same InfluxDB instance with speedtest data.

## Features

- **InfluxDB Integration**: Connects to your InfluxDB instance and executes InfluxQL queries
- **Discord Webhook Notifications**: Sends formatted messages to Discord channels via webhooks
- **Extensible Alerting**: New alerts can be added by simply creating a new JavaScript file in the `src/alerts` directory
- **Individual Alert Scheduling**: Each alert can run on its own schedule (daily, hourly, custom intervals)
- **Docker Support**: Production-ready containerization with security best practices
- **Environment Variable Support**: Secure configuration management for production deployments
- **Built-in Alert Collection**: Pre-configured alerts for performance monitoring and milestone celebrations

## Prerequisites

### For Docker Deployment (Production - Recommended)
- Docker Engine 20.10+ and Docker Compose v2.0+
- Access to an InfluxDB instance with speedtest data
- Discord webhook URLs for notifications

### For Direct Node.js Deployment (Development)
- [Node.js](https://nodejs.org/) (v16.6.0 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- Access to an InfluxDB instance (v1.x)
- A Discord server where you have permissions to create webhooks

## Quick Start (Docker - Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd multigig-bot
   ```

2. **Configure the bot:**
   ```bash
   cp config/config.example.json config/config.json
   # Edit config/config.json with your actual webhook URLs and InfluxDB settings
   ```

3. **Build and run with Docker:**
   ```bash
   ./docker-build-run.sh run
   ```

4. **View logs:**
   ```bash
   ./docker-build-run.sh logs
   ```

## Alternative Installation (Direct Node.js)

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd multigig-bot
   npm install
   ```

2. **Configure the bot:**
   ```bash
   cp config/config.example.json config/config.json
   # Edit config/config.json with your settings
   ```

3. **Run directly:**
   ```bash
   npm start
   ```

## Configuration

### Configuration File Method

The `config/config.json` file holds all the necessary settings for the bot to run:

```json
{
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/your-celebration-webhook",
    "alertwebhookUrl": "https://discord.com/api/webhooks/your-system-alert-webhook",
    "botUsername": "MultiGig Achievements",
    "botAvatarUrl": ""
  },
  "influxdb": {
    "host": "your-influxdb-host.com",
    "port": 443,
    "protocol": "https",
    "database": "speedtest-data",
    "username": "",
    "password": "",
    "token": "your-influxdb-api-token"
  },
  "cronSchedule": "* * * * *"
}
```

### Environment Variables (Production Recommended)

For production deployments, use environment variables:

```bash
# Discord Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-celebration-webhook
DISCORD_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/your-system-alert-webhook
DISCORD_BOT_USERNAME=MultiGig Achievements

# InfluxDB Configuration
INFLUXDB_HOST=your-influxdb-host.com
INFLUXDB_PORT=443
INFLUXDB_PROTOCOL=https
INFLUXDB_DATABASE=speedtest-data
INFLUXDB_TOKEN=your-influxdb-api-token

# Scheduling
CRON_SCHEDULE=* * * * *
```

### Configuration Fields

- `discord.webhookUrl`: **Required** - Celebration alerts and achievements webhook
- `discord.alertwebhookUrl`: **Required** - System errors and operational alerts webhook
- `discord.botUsername`: The username the bot will use when sending messages
- `discord.botAvatarUrl`: The URL of an image to use as the bot's avatar
- `influxdb`: Connection details for your InfluxDB instance
- `cronSchedule`: Global check frequency (individual alerts override this)
- `timezone`: **Optional** - IANA timezone for daily alerts (default: "America/New_York")
- `dailyAlertHour`: **Optional** - Hour (0-23) when daily alerts fire (default: 9 for 9 AM)

**Webhook Usage:**
- **webhookUrl**: Used for celebration alerts (milestones, daily winners, achievements)
- **alertwebhookUrl**: Used for system notifications (startup, errors, database issues, shutdowns, and celebration alerts during test mode)

**Daily Alert Scheduling:**
Daily alerts (like Daily Winners) now fire at a specific time in your configured timezone rather than 24-hour intervals from bot startup. Configure `timezone` (e.g., "America/New_York", "Europe/London", "Asia/Tokyo") and `dailyAlertHour` (0-23, where 9 = 9 AM) to control when these fire. This ensures daily reports arrive at predictable, reasonable hours.

## Built-in Alerts

The bot comes with several pre-configured celebration alerts that go to the main `webhookUrl`:

- **Cumulative Data Milestone** - Celebrates every 1TB of total data transferred
- **Daily Winners** - Daily performance champions in download, upload, and latency (fires at configured daily hour)
- **High Latency Award** - Worst latency "awards" (runs every 12 hours)
- **Packet Loss Alert** - Real-time packet loss detection (only fires when packet loss > 5%)
- **Waiting and Watching Alert** - Sarcastic bot status updates (chaos scheduled)
- **Site Download/Upload Milestones** - Individual site achievements
- **Time Wasted Alert** - Celebrates collective time spent on speed tests

**Example/Demo Alerts** (test mode only):
- **Example Alert** - Basic webhook connectivity test (`TEST_WEBHOOK=true`)
- **Chaos Example Alert** - Demonstrates chaos scheduling system
- **Time Wasted Chaos Example** - Shows how to convert alerts to chaos scheduling

**System Notifications** (sent to `alertwebhookUrl`):
- Bot startup/shutdown notifications
- Database connection errors
- Critical system errors
- Alert processing failures

**Test Site Discovery:**
The bot automatically discovers test sites from your InfluxDB data using `GROUP BY "test_site"` in queries. There's no hardcoded list of sites - when new test sites come online and start reporting data to InfluxDB, they will automatically be included in alerts. No configuration changes needed for new sites.

## Test Mode and Example Alerts

The bot includes comprehensive test modes to safely test functionality without spamming your main Discord channels:

### Available Test Modes

- **TEST_MODE=true**: Redirects all celebration alerts to `alertwebhookUrl` instead of `webhookUrl`, enables example alerts
- **TEST_ERROR_LOGGING=true**: Sends test error messages to verify error logging system
- **TEST_WEBHOOK=true**: Triggers example alert for basic webhook testing, enables example alerts
- **NODE_ENV=test**: Test environment mode, enables example alerts

### Example Alerts

The bot includes several example/demonstration alerts that **only fire in test mode**:

- **exampleAlert.js** - Basic webhook connectivity test (requires `TEST_WEBHOOK=true`)
- **chaosExampleAlert.js** - Demonstrates chaos scheduling with unpredictable timing
- **timeWastedChaoExample.js** - Shows how to convert regular alerts to chaos scheduling

**Production Safety**: Example alerts automatically detect test mode and will never trigger in production environments. This prevents spam from demonstration alerts.

### Running Tests

```bash
# Test mode only (redirect alerts to alertwebhookUrl + enable examples)
./docker-build-run.sh test-mode

# Test error logging system
./docker-build-run.sh test-errors

# All test modes enabled
./docker-build-run.sh test-all

# Test webhook connectivity specifically
TEST_WEBHOOK=true npm start

# Or with npm
npm run docker:test-mode
npm run docker:test-all

# Direct Node.js
TEST_MODE=true npm start
```

### What Happens in Test Mode

- All celebration alerts are prefixed with `🧪 **TEST MODE**`
- Alerts are redirected to the `alertwebhookUrl` channel
- Bot username gets `[TEST]` prefix
- Example alerts become active and can fire
- Clear console indicators show test mode is active

For detailed test mode documentation, see [TEST-MODE.md](TEST-MODE.md).

## Creating Custom Alerts

Creating a new alert is simple. Just add a new `.js` file to the `src/alerts/` directory. The bot will automatically load it on startup.

Each alert file must export an object with these properties:

- `name` (String): A descriptive name for the alert, used for logging
- `schedule` (String, Optional): How often this alert runs (`'daily'`, `'hourly'`, `'5m'`, `'30s'`, etc.)
- `query` (String): The InfluxQL query to fetch the data
- `condition` (Function): Returns `true` if the alert should be triggered
- `message` (Function): Returns the string message to be sent to Discord

### Example Production Alert

`src/alerts/customAlert.js`:
```javascript
module.exports = {
  name: 'Custom Performance Alert',
  schedule: '5m', // Run every 5 minutes

  query: `SELECT mean("download_bandwidth") as avg_download FROM "speedtest_result" WHERE time > now() - 5m GROUP BY "test_site"`,

  condition: (results) => {
    if (!results || results.length === 0) return false;
    const threshold = 100000000; // 100 Mbps in bytes/sec
    return results.some(result => result.avg_download < threshold);
  },

  message: (results) => {
    const slowSites = results.filter(r => r.avg_download < 100000000);
    let message = `**⚠️ Slow Download Speed Alert!**\n\n`;

    slowSites.forEach(site => {
      const mbps = (site.avg_download * 8 / 1000000).toFixed(2);
      message += `• **${site.test_site}**: ${mbps} Mbps\n`;
    });

    return message;
  }
};
```

### Example Test-Only Alert

`src/alerts/exampleDemoAlert.js`:
```javascript
module.exports = {
  name: 'Example Demo Alert - Test Only',
  schedule: 'chaos:15m', // Unpredictable timing

  query: `SELECT COUNT(*) as test_count FROM "speedtest_result" WHERE time > now() - 1h`,

  condition: (results) => {
    // Test mode check - this alert only fires in test environments
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
    const testCount = results[0]?.test_count || 0;
    return `🧪 **Example Demo Alert Triggered**\n\nThis only fires in test mode!\nRecent tests: ${testCount}`;
  }
};
```

## Docker Management

### Using the Build Script

The included `docker-build-run.sh` script provides comprehensive container management:

```bash
# Build and run (default)
./docker-build-run.sh run

# Build image only
./docker-build-run.sh build

# View logs
./docker-build-run.sh logs

# Check status
./docker-build-run.sh status

# Stop container
./docker-build-run.sh stop

# Restart container
./docker-build-run.sh restart

# Clean up everything
./docker-build-run.sh cleanup

# Run with environment variables
USE_ENV_VARS=true ./docker-build-run.sh run
```

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart
```

### Using npm Scripts

```bash
npm run docker:run         # Build and run container
npm run docker:logs        # View container logs
npm run docker:stop        # Stop container
npm run docker:test-mode   # Run in test mode (alerts -> alertwebhookUrl)
npm run docker:test-errors # Test error logging system
npm run docker:test-all    # Run with all test modes enabled
npm run compose:up         # Start with docker-compose
npm run compose:down       # Stop docker-compose services
```

## Direct Node.js Execution

For development or non-containerized deployments:

```bash
npm start
```

The bot will start, load all alerts, and begin executing checks. Each alert runs according to its individual schedule.

## Project Structure

```
multigig-bot/
├── config/
│   ├── config.example.json    # Configuration template
│   └── config.json           # Your actual configuration (not in git)
├── src/
│   ├── alerts/               # Alert definition files
│   │   ├── cumulativeDataAlert.js
│   │   ├── dailyWinnersAlert.js
│   │   ├── highLatencyAlert.js
│   │   ├── packetLossAlert.js
│   │   ├── siteDownloadMilestonesAlert.js
│   │   ├── siteUploadMilestonesAlert.js
│   │   ├── timeWastedAlert.js
│   │   └── exampleAlert.js
│   ├── services/
│   │   └── influxdb-http.js  # HTTP-based InfluxDB service
│   └── index.js              # Main application entry point
├── Dockerfile                # Container definition
├── docker-compose.yml        # Container orchestration
├── docker-build-run.sh       # Docker management script
├── .dockerignore            # Docker build exclusions
├── .gitignore               # Git exclusions
├── DEPLOYMENT.md            # Production deployment guide
├── package.json
└── README.md
```

## Production Deployment

For production deployments, see the comprehensive [DEPLOYMENT.md](DEPLOYMENT.md) guide which covers:

- Security best practices
- Environment variable configuration
- Container resource management
- Monitoring and logging
- Automated deployment options
- Troubleshooting common issues

## Dependencies

- [discord.js](https://discord.js.org/): Official Discord API library for Node.js
- [axios](https://axios-http.com/): HTTP client for InfluxDB API calls
- [node-cron](https://github.com/node-cron/node-cron): Cron-like job scheduler

## Security Notes

- Never commit `config/config.json` to version control
- Use environment variables for sensitive data in production
- The Docker container runs as a non-root user for security
- Configuration files are mounted read-only in containers
