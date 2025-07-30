# Test Mode Documentation

## Overview

The MultiGig Bot includes comprehensive test modes to help you safely test functionality without spamming your main Discord channels. Test modes redirect alerts, enable test messages, and provide clear indicators when testing is active.

## Available Test Modes

### 1. TEST_MODE (Alert Redirection)
**Purpose**: Redirects all celebration alerts to the `alertwebhookUrl` instead of `webhookUrl`
**Environment Variable**: `TEST_MODE=true`
**Use Case**: Testing alert logic without spamming the main celebrations channel

### 2. TEST_ERROR_LOGGING (Error Testing)
**Purpose**: Sends test error and warning messages to verify error logging system
**Environment Variable**: `TEST_ERROR_LOGGING=true`
**Use Case**: Verifying that error notifications reach Discord properly

### 3. TEST_WEBHOOK (Manual Webhook Test)
**Purpose**: Triggers the example alert for manual webhook testing
**Environment Variable**: `TEST_WEBHOOK=true`
**Use Case**: Basic webhook connectivity testing

## Test Mode Activation

### Docker Script Methods

```bash
# Test mode only (alert redirection)
./docker-build-run.sh test-mode

# Error logging test only
./docker-build-run.sh test-errors

# All test modes enabled
./docker-build-run.sh test-all
```

### npm Script Methods

```bash
# Test mode only
npm run docker:test-mode

# Error logging test only
npm run docker:test-errors

# All test modes
npm run docker:test-all
```

### Docker Compose Method

Edit `docker-compose.yml` and uncomment the test environment variables:

```yaml
environment:
  # Uncomment for testing
  - TEST_MODE=true                    # Redirect alerts to alertwebhookUrl
  - TEST_ERROR_LOGGING=true           # Enable error logging tests
  - TEST_WEBHOOK=true                 # Enable webhook test alert
```

Then run:
```bash
docker-compose up -d
```

### Direct Node.js Method

```bash
# Single test mode
TEST_MODE=true npm start

# Multiple test modes
TEST_MODE=true TEST_ERROR_LOGGING=true npm start

# All test modes
TEST_MODE=true TEST_ERROR_LOGGING=true TEST_WEBHOOK=true npm start
```

### Environment File Method

Create a `.env.test` file:
```bash
TEST_MODE=true
TEST_ERROR_LOGGING=true
TEST_WEBHOOK=true
```

Load it when running:
```bash
export $(cat .env.test | xargs) && npm start
```

## What Happens in Test Mode

### TEST_MODE=true Effects

1. **Alert Redirection**: All celebration alerts go to `alertwebhookUrl`
2. **Message Prefixing**: All alerts get prefixed with `🧪 **TEST MODE**`
3. **Username Modification**: Bot username gets `[TEST]` prefix
4. **Console Logging**: Clear indicators that test mode is active
5. **Startup Notification**: Includes test mode status in startup message

### TEST_ERROR_LOGGING=true Effects

1. **Automatic Test Messages**: Sends test error and warning messages 2-4 seconds after startup
2. **Error System Verification**: Confirms error logging to Discord works
3. **Pattern Testing**: Tests both error and warning detection patterns

### TEST_WEBHOOK=true Effects

1. **Example Alert Trigger**: Forces the example alert to trigger regardless of conditions
2. **Connectivity Test**: Verifies basic webhook connectivity
3. **Database Status**: Shows whether InfluxDB connection is working

## Expected Test Messages

### Test Mode Startup Message (alertwebhookUrl)
```
🟢 **MultiGig Bot Started Successfully**

📊 Status: Bot is now online and monitoring
🔔 Alerts Loaded: 8 alert(s)
⏰ Schedule: * * * * *
🏥 Health: All systems operational
📝 Error Logging: All [ERROR] messages will be sent to this channel
🛡️ Rate Limiting: Maximum 5 error notifications per minute
🧪 TEST MODE: Celebration alerts will also be sent to this channel
```

### Test Error Messages (TEST_ERROR_LOGGING=true)
```
🚨 **SYSTEM ERROR**

**Time**: 2024-01-15 14:30:27
**Message**: Test error message - this should appear in Discord
**Source**: MultiGig Bot Application
```

```
⚠️ **SYSTEM WARNING**

**Time**: 2024-01-15 14:30:29
**Message**: Test critical warning - this should also appear in Discord
**Source**: MultiGig Bot Application
```

### Test Webhook Alert (TEST_WEBHOOK=true)
```
🧪 **TEST MODE**

🧪 **MANUAL WEBHOOK TEST ALERT** 🧪

✅ **Status:** Manual test triggered successfully!
⏰ **Time:** 1/15/2024, 2:30:30 PM
📊 **Database Status:** Connected (42 records in last hour)

🎯 **Test Results:**
• InfluxDB query executed successfully
• Alert condition triggered manually via TEST_WEBHOOK=true
• Discord webhook is receiving messages ✅

🚀 **Your MultiGig Bot webhook is working!**
*All systems operational!*
*To test again, restart with TEST_WEBHOOK=true*
```

### Celebration Alerts in Test Mode
All celebration alerts (milestones, daily winners, etc.) will be prefixed with:
```
🧪 **TEST MODE**

[Original alert content here]
```

And sent to the `alertwebhookUrl` instead of `webhookUrl`.

## Console Output in Test Mode

### Startup Messages
```
[INFO] TEST MODE: ENABLED - All celebration alerts will be sent to alertwebhookUrl
[INFO] TEST MODE: Main webhook (celebrations) -> Alert webhook (testing)
[INFO] TEST MODE: Error notifications -> Alert webhook (normal)
[INFO] Error logging test mode: ENABLED
```

### Runtime Messages
```
[INFO] TEST MODE: Redirecting celebration alerts to alertwebhookUrl
[INFO] Alert notification sent for Daily Performance Winners (TEST MODE).
```

## Best Practices for Testing

### Before Testing
1. **Inform your team**: Let others know you're testing to avoid confusion
2. **Check webhook URLs**: Ensure both webhooks are properly configured
3. **Monitor both channels**: Watch both the main and alert channels during testing
4. **Document tests**: Keep track of what you're testing and results

### During Testing
1. **Use appropriate test modes**: Don't enable all tests if you only need one
2. **Check logs frequently**: Monitor console output for test confirmations
3. **Verify message routing**: Confirm alerts go to the expected channels
4. **Test incrementally**: Start with simple tests before complex scenarios

### After Testing
1. **Disable test modes**: Always turn off test modes when done
2. **Clean up containers**: Remove test containers to avoid confusion
3. **Verify normal operation**: Confirm bot works normally after testing
4. **Document findings**: Record any issues or improvements needed

## Troubleshooting Test Mode

### Test Mode Not Activating
```bash
# Check if environment variables are set
docker exec multigig-bot-container env | grep TEST

# Check console logs for test mode messages
docker logs multigig-bot-container | grep "TEST MODE"
```

### Alerts Still Going to Main Channel
- Verify `TEST_MODE=true` is set in environment
- Check console logs for "Redirecting celebration alerts" message
- Ensure container was restarted after setting test mode

### Test Messages Not Appearing
- Verify `alertwebhookUrl` is correctly configured
- Check webhook permissions in Discord
- Monitor rate limiting (max 5 errors per minute)
- Check console for webhook delivery errors

### Multiple Test Instances
- Ensure only one test container is running
- Check for conflicting environment variables
- Use `docker ps` to verify running containers

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Test MultiGig Bot
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and test
        run: |
          cp config/config.example.json config/config.json
          # Set test webhook URLs
          sed -i 's/YOUR_CELEBRATION_WEBHOOK_TOKEN/${{ secrets.TEST_WEBHOOK }}/' config/config.json
          sed -i 's/YOUR_SYSTEM_ALERT_WEBHOOK_TOKEN/${{ secrets.TEST_WEBHOOK }}/' config/config.json
          
          # Run in test mode
          TEST_MODE=true TEST_ERROR_LOGGING=true timeout 60 npm start
```

### Automated Testing Script
```bash
#!/bin/bash
# test-bot.sh

echo "Starting MultiGig Bot test suite..."

# Start in test mode
TEST_MODE=true TEST_ERROR_LOGGING=true npm start &
BOT_PID=$!

# Wait for startup
sleep 10

# Check if bot is responding
if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Bot started successfully in test mode"
else
    echo "❌ Bot failed to start"
    exit 1
fi

# Let it run for a minute to test alerts
sleep 50

# Clean shutdown
kill $BOT_PID
wait $BOT_PID

echo "✅ Test completed successfully"
```

## Security Considerations

### Test Mode Indicators
- All test messages are clearly marked with `🧪 **TEST MODE**`
- Bot username includes `[TEST]` prefix
- Console output clearly indicates test mode is active
- Startup notifications include test mode status

### Webhook Security
- Test mode doesn't bypass webhook authentication
- Same security measures apply as normal operation
- Consider using separate test webhooks for isolation
- Monitor test channels for unauthorized access

### Data Protection
- Test mode doesn't change data access patterns
- Same InfluxDB queries are executed
- No additional data exposure in test mode
- Test messages don't contain sensitive information

Test mode provides a safe, clearly-marked way to verify your MultiGig Bot configuration without disrupting normal operations. Always remember to disable test modes when returning to production use.