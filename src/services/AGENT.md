# Services Directory - Agent Documentation

## Directory Purpose

This directory contains reusable service classes that provide abstractions for external systems and dependencies. Services act as the interface layer between the core application and external resources like databases, APIs, and third-party systems.

## Service Architecture Pattern

Services in this directory should follow these principles:

1. **Single Responsibility**: Each service handles one external system or related group of operations
2. **Stateless Design**: Services should not maintain state between calls
3. **Error Handling**: Robust error handling with meaningful error messages
4. **Configuration Driven**: Accept configuration in constructor, don't hardcode connections
5. **Async/Promise Based**: Use modern async/await patterns for all operations

## Current Services

### `influxdb.js` - InfluxDB Service
- **Purpose**: Handles all InfluxDB database operations
- **Responsibilities**:
  - Establish and manage database connections
  - Execute InfluxQL queries
  - Handle connection errors and retries
  - Validate query results

## Service Implementation Pattern

```javascript
class ServiceName {
  constructor(config) {
    // Validate required configuration
    if (!config || !config.requiredField) {
      throw new Error('[ERROR] ServiceName configuration missing required fields');
    }
    
    // Initialize client/connection
    this.client = new ExternalClient(config);
  }

  async operation(parameters) {
    try {
      const result = await this.client.performOperation(parameters);
      return result;
    } catch (error) {
      console.error(`[ERROR] ServiceName operation failed: ${error.message}`);
      throw error; // Re-throw or handle gracefully based on requirements
    }
  }
}

module.exports = ServiceName;
```

## Development Guidelines for Agents

### Creating New Services

1. **File Naming**: Use lowercase with descriptive names (e.g., `discord.js`, `email.js`, `database.js`)
2. **Class Naming**: Use PascalCase matching the service purpose (e.g., `DiscordService`, `EmailService`)
3. **Configuration**: Always accept configuration in constructor
4. **Documentation**: Include JSDoc comments for all public methods
5. **Testing**: Design methods to be easily testable with mocks

### Configuration Handling

```javascript
constructor(config) {
  // Always validate required fields
  const required = ['host', 'port', 'database'];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`[ERROR] ${this.constructor.name} missing required config: ${field}`);
    }
  }
  
  // Set defaults for optional fields
  this.config = {
    timeout: 5000,
    retries: 3,
    ...config
  };
}
```

### Error Handling Patterns

```javascript
// Pattern 1: Log and re-throw for caller to handle
async query(sql) {
  try {
    return await this.client.query(sql);
  } catch (error) {
    console.error(`[ERROR] Database query failed: ${error.message}`);
    throw error;
  }
}

// Pattern 2: Return error result instead of throwing
async queryWithResult(sql) {
  try {
    const data = await this.client.query(sql);
    return { success: true, data };
  } catch (error) {
    console.error(`[ERROR] Database query failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Pattern 3: Retry with exponential backoff
async queryWithRetry(sql, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.client.query(sql);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.warn(`[WARN] Query attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Connection Management

```javascript
class DatabaseService {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    
    try {
      this.client = new DatabaseClient(this.config);
      await this.client.connect();
      this.connected = true;
      console.log('[INFO] Database connection established');
    } catch (error) {
      console.error('[ERROR] Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect() {
    if (!this.connected) return;
    
    try {
      await this.client.disconnect();
      this.connected = false;
      console.log('[INFO] Database connection closed');
    } catch (error) {
      console.error('[ERROR] Error closing database connection:', error);
    }
  }

  async ensureConnection() {
    if (!this.connected) {
      await this.connect();
    }
  }
}
```

## Common Service Types

### Database Services
- Handle database connections and queries
- Implement connection pooling
- Provide query builders or ORM-like interfaces
- Example: `influxdb.js`, `postgres.js`, `mongodb.js`

### API Services
- Wrapper for external REST/GraphQL APIs
- Handle authentication and rate limiting
- Implement request/response transformation
- Example: `github.js`, `slack.js`, `monitoring.js`

### Notification Services
- Send messages via various channels
- Handle message formatting and templating
- Manage delivery failures and retries
- Example: `discord.js`, `email.js`, `sms.js`

### Cache Services
- Provide caching abstractions
- Handle cache invalidation strategies
- Support different cache backends
- Example: `redis.js`, `memory.js`

## Integration with Main Application

Services are typically initialized in `src/index.js`:

```javascript
const InfluxDBService = require('./services/influxdb');
const DiscordService = require('./services/discord');
const config = require('../config/config.json');

// Initialize services
const influxDB = new InfluxDBService(config.influxdb);
const discord = new DiscordService(config.discord);

// Use services in application logic
const results = await influxDB.query(alert.query);
await discord.sendMessage(alert.message(results));
```

## Testing Services

### Unit Testing
- Mock external dependencies
- Test error conditions
- Verify configuration validation
- Test retry logic

### Integration Testing
- Test against real external services (in test environment)
- Verify connection handling
- Test timeout scenarios
- Validate data transformation

## Security Considerations

- Never log sensitive configuration data (passwords, API keys)
- Validate all inputs to prevent injection attacks
- Use secure connection methods (TLS/SSL)
- Implement proper authentication and authorization
- Consider rate limiting and abuse prevention

## Performance Considerations

- Implement connection pooling for database services
- Cache frequently accessed data when appropriate
- Use async/await to prevent blocking operations
- Monitor and log performance metrics
- Implement circuit breaker patterns for unreliable services

## Service Dependencies

- Keep services independent when possible
- If services must interact, use dependency injection
- Avoid circular dependencies between services
- Consider using a service registry for complex applications

## Common Patterns to Avoid

- Don't hardcode configuration values
- Don't ignore error conditions
- Don't mix business logic with service logic
- Don't create overly complex service interfaces
- Don't forget to handle connection cleanup