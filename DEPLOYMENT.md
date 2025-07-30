# MultiGig Bot - Production Deployment Guide

## Overview

This guide covers deploying the MultiGig Bot to production using Docker containers. The bot monitors InfluxDB metrics and sends alerts to Discord channels via webhooks.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2.0+
- Access to InfluxDB instance with speedtest data
- Discord webhook URLs for notifications
- Linux/Unix environment (recommended)

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd multigig-bot
   ```

2. **Configure the Bot**
   ```bash
   cp config/config.example.json config/config.json
   # Edit config/config.json with your actual values
   ```

3. **Build and Run**
   ```bash
   # Production deployment
   ./docker-build-run.sh run
   
   # Or test deployment (alerts go to alertwebhookUrl)
   ./docker-build-run.sh test-mode
   ```

## Configuration Methods

### Method 1: Configuration File (Recommended for Development)

1. Copy the example configuration:
   ```bash
   cp config/config.example.json config/config.json
   ```

2. Edit `config/config.json` with your values:
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
       "token": "your-influxdb-api-token"
     },
     "cronSchedule": "* * * * *"
   }
   ```

3. Run with configuration file:
   ```bash
   ./docker-build-run.sh run
   ```

### Method 2: Environment Variables (Recommended for Production)

1. Create a `.env` file:
   ```bash
   # Discord Configuration
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-celebration-webhook
   DISCORD_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/your-system-alert-webhook
   DISCORD_BOT_USERNAME=MultiGig Achievements
   DISCORD_BOT_AVATAR_URL=

   # InfluxDB Configuration
   INFLUXDB_HOST=your-influxdb-host.com
   INFLUXDB_PORT=443
   INFLUXDB_PROTOCOL=https
   INFLUXDB_DATABASE=speedtest-data
   INFLUXDB_TOKEN=your-influxdb-api-token

   # Scheduling
   CRON_SCHEDULE=* * * * *
   ```

2. Run with environment variables:
   ```bash
   # Production
   USE_ENV_VARS=true ./docker-build-run.sh run
   
   # Test mode
   USE_ENV_VARS=true TEST_MODE=true ./docker-build-run.sh run
   ```

## Docker Management

### Using the Build Script

The `docker-build-run.sh` script provides comprehensive container management:

```bash
# Build and run (default)
./docker-build-run.sh run

# Build image only
./docker-build-run.sh build

# Force rebuild and run
./docker-build-run.sh rebuild

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

# Test mode options
./docker-build-run.sh test-mode      # Redirect alerts to alertwebhookUrl
./docker-build-run.sh test-errors    # Test error logging system  
./docker-build-run.sh test-all       # All test modes enabled
```

### Using Docker Compose

1. **For file-based configuration:**
   ```bash
   docker-compose up -d
   ```

2. **For environment variable configuration:**
   - Edit `docker-compose.yml` to uncomment the environment section
   - Comment out the volumes section
   - Create a `.env` file with your values
   - Run: `docker-compose up -d`

3. **Management commands:**
   ```bash
   # View logs
   docker-compose logs -f

   # Stop services
   docker-compose down

   # Restart services
   docker-compose restart

   # Pull latest and restart
   docker-compose pull && docker-compose up -d
   ```

## Production Deployment

### Security Best Practices

1. **Never commit sensitive data:**
   - Use `.gitignore` to exclude `config/config.json`
   - Store secrets in environment variables or secrets management
   - Use read-only volume mounts when possible

2. **Container security:**
   - Bot runs as non-root user (multigig:nodejs)
   - Uses Alpine Linux base image (smaller attack surface)
   - No-new-privileges security option enabled

3. **Network security:**
   - Container only needs outbound HTTPS access
   - No inbound ports required
   - Consider running in isolated Docker network

### Resource Management

1. **Memory limits:**
   ```yaml
   # In docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 256M
       reservations:
         memory: 128M
   ```

2. **CPU limits:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
       reservations:
         cpus: '0.1'
   ```

### Monitoring and Logging

1. **View logs:**
   ```bash
   docker logs -f multigig-bot-container
   ```

2. **Log rotation:**
   ```yaml
   # In docker-compose.yml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

3. **Health checks:**
   ```bash
   docker inspect multigig-bot-container --format='{{.State.Health.Status}}'
   ```

### Automated Deployment

#### Using Systemd (Linux)

1. Create service file `/etc/systemd/system/multigig-bot.service`:
   ```ini
   [Unit]
   Description=MultiGig Bot Discord Alert Service
   Requires=docker.service
   After=docker.service

   [Service]
   Type=oneshot
   RemainAfterExit=yes
   WorkingDirectory=/opt/multigig-bot
   ExecStart=/opt/multigig-bot/docker-build-run.sh run
   ExecStop=/opt/multigig-bot/docker-build-run.sh stop
   TimeoutStartSec=0

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl enable multigig-bot
   sudo systemctl start multigig-bot
   ```

#### Using Cron for Updates

Add to crontab for automatic updates:
```bash
# Update and restart MultiGig Bot daily at 2 AM
0 2 * * * cd /opt/multigig-bot && git pull && ./docker-build-run.sh rebuild
```

## Configuration Reference

### Discord Settings

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `webhookUrl` | Yes | Celebration alerts and achievements webhook | `https://discord.com/api/webhooks/...` |
| `alertwebhookUrl` | Yes | System errors and operational alerts webhook | `https://discord.com/api/webhooks/...` |
| `botUsername` | No | Display name for bot messages | `"MultiGig Achievements"` |
| `botAvatarUrl` | No | Avatar image URL | `"https://example.com/avatar.png"` |

**Webhook Usage:**
- **webhookUrl**: Used for celebration alerts (milestones, daily winners, achievements)
- **alertwebhookUrl**: Used for system notifications (startup, errors, database issues, shutdowns, and celebration alerts during test mode)

### InfluxDB Settings

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `host` | Yes | InfluxDB server hostname | `"influx.example.com"` |
| `port` | Yes | InfluxDB server port | `443` |
| `protocol` | Yes | Connection protocol | `"https"` |
| `database` | Yes | Database name | `"speedtest-data"` |
| `token` | Yes | API authentication token | `"your-token-here"` |
| `username` | No | Legacy auth username | `"user"` |
| `password` | No | Legacy auth password | `"pass"` |

### Scheduling Settings

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `cronSchedule` | No | Global check frequency | `"* * * * *"` (every minute) |

Individual alerts have their own `schedule` property that overrides the global schedule.

## Alert Configuration

### Built-in Alerts

The bot includes several pre-configured celebration alerts that go to the main `webhookUrl`:

1. **Cumulative Data Milestone** - Celebrates every 1TB of total data transferred
2. **Daily Winners** - Daily performance champions announcement
3. **High Latency Award** - Daily worst latency "awards"
4. **Packet Loss Alert** - Real-time packet loss detection
5. **Site Download Milestones** - Individual site download achievements
6. **Site Upload Milestones** - Individual site upload achievements  
7. **Time Wasted Alert** - Celebrates collective time spent on speed tests

**System Notifications** (sent to `alertwebhookUrl`):
- Bot startup/shutdown notifications
- Database connection errors
- Critical system errors
- Alert processing failures

### Alert Schedules and Test Site Discovery

Each alert runs on its own schedule:
- Real-time monitoring: Every 30 seconds to 1 minute
- Regular checks: Every 5-15 minutes
- Daily reports: Once per day
- Milestone celebrations: Every 10-15 minutes

**Test Site Discovery:**
The bot automatically discovers test sites from your InfluxDB data using `GROUP BY "test_site"` in queries. There's no hardcoded list of sites - when new test sites come online and start reporting data to InfluxDB, they will automatically be included in alerts. No configuration changes needed for new sites.

### Test Mode Deployment

For testing without spamming your main celebrations channel:

```bash
# Deploy in test mode (alerts go to alertwebhookUrl)
./docker-build-run.sh test-mode

# Test error logging system
./docker-build-run.sh test-errors

# All test modes enabled
./docker-build-run.sh test-all
```

**Test Mode Effects:**
- All celebration alerts redirected to `alertwebhookUrl`
- Messages prefixed with `🧪 **TEST MODE**`
- Bot username gets `[TEST]` prefix
- Clear console indicators show test mode is active

**Environment Variables for Test Mode:**
- `TEST_MODE=true` - Redirect celebration alerts to alertwebhookUrl
- `TEST_ERROR_LOGGING=true` - Enable error logging tests
- `TEST_WEBHOOK=true` - Enable webhook connectivity test

For comprehensive test mode documentation, see [TEST-MODE.md](TEST-MODE.md).

### Adding Custom Alerts

1. Create a new file in `src/alerts/` directory
2. Export an object with required properties:
   ```javascript
   module.exports = {
     name: "My Custom Alert",
     schedule: "5m", // Optional: defaults to 1 minute
     query: "SELECT * FROM measurement WHERE condition",
     condition: (results) => { /* return boolean */ },
     message: (results) => { /* return string */ }
   };
   ```

## Troubleshooting

### Container Won't Start

1. **Check configuration:**
   ```bash
   docker logs multigig-bot-container
   ```

2. **Verify config file:**
   ```bash
   # Validate JSON syntax
   cat config/config.json | python -m json.tool
   ```

3. **Test InfluxDB connection:**
   ```bash
   # From host system
   curl -I "https://your-influxdb-host:443"
   ```

### No Alerts Being Sent

1. **Check webhook URLs:**
   - Test Discord webhooks manually
   - Verify alertwebhookUrl is configured correctly

2. **Check InfluxDB queries:**
   - Verify data exists in database
   - Test queries manually against InfluxDB

3. **Check alert conditions:**
   - Review alert logic in `src/alerts/` files
   - Check if conditions are being met

### Performance Issues

1. **Monitor resource usage:**
   ```bash
   docker stats multigig-bot-container
   ```

2. **Check log file sizes:**
   ```bash
   docker inspect multigig-bot-container --format='{{.LogPath}}'
   ```

3. **Optimize queries:**
   - Add time ranges to InfluxDB queries
   - Use appropriate aggregation functions

## Maintenance

### Regular Tasks

1. **Monitor logs for errors:**
   ```bash
   ./docker-build-run.sh logs | grep ERROR
   ```

2. **Update the bot:**
   ```bash
   git pull
   ./docker-build-run.sh rebuild
   ```

3. **Clean up Docker resources:**
   ```bash
   docker system prune -f
   ```

### Backup and Recovery

1. **Configuration backup:**
   ```bash
   cp config/config.json config/config.backup.$(date +%Y%m%d)
   ```

2. **Full backup:**
   ```bash
   tar -czf multigig-bot-backup-$(date +%Y%m%d).tar.gz \
       --exclude=node_modules \
       --exclude=.git \
       .
   ```

## Support

### Logs and Debugging

- Container logs: `docker logs -f multigig-bot-container`
- Application logs: Check console output for `[INFO]`, `[WARN]`, `[ERROR]` messages
- Health status: `docker inspect multigig-bot-container --format='{{.State.Health.Status}}'`

### Common Issues

1. **"WebhookClient" errors:** Check Discord webhook URLs
2. **InfluxDB connection errors:** Verify host, port, and authentication
3. **Alert not triggering:** Check query results and condition logic
4. **Container exits immediately:** Check configuration file syntax

For additional support, check the project's issue tracker or documentation.