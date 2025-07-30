# MultiGig Bot - Agent Documentation

## Project Overview

This is a Discord bot application that monitors InfluxDB metrics and sends alerts to Discord channels via webhooks. The bot is designed to be extensible and allows for easy creation of custom alerts.

## Architecture

```
multigig-bot/
├── config/          # Configuration files
├── src/             # Source code
│   ├── alerts/      # Alert definitions
│   ├── services/    # Service modules
│   └── index.js     # Main application entry point
├── package.json     # Node.js dependencies and scripts
└── README.md        # User documentation
```

## Key Components

### Core Application (`src/index.js`)
- Main entry point that orchestrates the entire application
- Loads alert modules dynamically from the alerts directory
- Schedules cron jobs to run alert checks
- Handles Discord webhook communication
- Manages graceful shutdown

### Services (`src/services/`)
- Contains reusable service modules
- Currently includes InfluxDB service for database operations
- Services are designed to be stateless and reusable

### Alerts (`src/alerts/`)
- Contains individual alert definitions
- Each alert is a separate module with standardized exports
- Alerts define: name, query, condition function, and message function
- New alerts can be added by creating new files in this directory

### Configuration (`config/`)
- Contains JSON configuration files
- Stores sensitive data like API keys and connection strings
- Separates configuration from code for security and flexibility

## Development Guidelines

### Adding New Alerts
1. Create a new `.js` file in `src/alerts/`
2. Export an object with: `name`, `query`, `condition`, `message`
3. The application will automatically load it on startup

### Adding New Services
1. Create a new file in `src/services/`
2. Export a class or object with clear, documented methods
3. Import and initialize in `index.js` as needed

### Configuration Changes
- Update `config/config.json` for runtime configuration
- Document new config options in README.md
- Consider environment variable alternatives for sensitive data

## Agent Instructions

When working with this codebase:

1. **Maintain the modular structure** - keep alerts, services, and config separate
2. **Follow the alert pattern** - all alerts must export the four required properties
3. **Handle errors gracefully** - the bot should continue running even if individual alerts fail
4. **Log appropriately** - use console.log for info, console.warn for warnings, console.error for errors
5. **Respect the configuration pattern** - don't hardcode values that should be configurable
6. **Test InfluxQL queries** - ensure queries are valid and return expected data structures
7. **Consider Discord message formatting** - use Discord markdown for better readability

## Common Tasks

- **Adding CPU monitoring alert**: Create new file in `src/alerts/` based on `exampleAlert.js`
- **Adding memory monitoring**: Similar to CPU, adjust query and thresholds
- **Adding database service**: Create new service in `src/services/`
- **Changing check frequency**: Update `cronSchedule` in `config/config.json`
- **Adding new notification channels**: Extend Discord service or create new notification service

## Security Considerations

- Never commit sensitive data in config files
- Use environment variables for production secrets
- Validate all user inputs and database results
- Implement rate limiting for webhook calls if needed