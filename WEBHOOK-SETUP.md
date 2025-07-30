# Discord Webhook Setup Guide

## Overview

The MultiGig Bot uses two separate Discord webhooks for different types of notifications:

1. **Main Webhook (`webhookUrl`)** - For celebration alerts and achievements
2. **System Alert Webhook (`alertwebhookUrl`)** - For system errors and operational notifications

## Webhook Purposes

### Main Webhook (`webhookUrl`)
**Used for:** Fun, celebration, and achievement notifications
- 🎉 Cumulative data milestones (every 1TB)
- 🏆 Daily performance winners
- 🎯 Site-specific download/upload milestones
- ⏰ Time wasted celebrations
- 📊 Performance awards and leaderboards
- 🚨 Packet loss alerts (when they occur)

### System Alert Webhook (`alertwebhookUrl`) 
**Used for:** System status and error notifications
- 🟢 Bot startup notifications
- 🔴 Bot shutdown notifications
- ⚠️ Database connection errors
- 🚨 Critical system errors
- 💥 Alert processing failures
- 🔧 Operational status updates

## Creating Discord Webhooks

### Step 1: Create the Main Celebrations Channel

1. **Create or select a Discord channel** for celebrations (e.g., `#multigig-achievements`)
2. **Right-click the channel** → `Edit Channel`
3. **Go to Integrations** → `Webhooks`
4. **Click "Create Webhook"**
5. **Configure the webhook:**
   - Name: `MultiGig Celebrations`
   - Avatar: Optional celebration emoji or image
6. **Copy the Webhook URL** - this is your `webhookUrl`

### Step 2: Create the System Alerts Channel

1. **Create or select a Discord channel** for system alerts (e.g., `#multigig-system`)
2. **Right-click the channel** → `Edit Channel`
3. **Go to Integrations** → `Webhooks`
4. **Click "Create Webhook"**
5. **Configure the webhook:**
   - Name: `MultiGig System Alerts`
   - Avatar: Optional warning/system emoji or image
6. **Copy the Webhook URL** - this is your `alertwebhookUrl`

## Recommended Channel Setup

### Option 1: Separate Channels (Recommended)
```
#multigig-achievements    ← Main webhook (celebrations)
#multigig-system         ← Alert webhook (system notifications)
```

### Option 2: Same Channel with Different Names
```
#multigig-notifications  ← Both webhooks (with different usernames)
```

### Option 3: Integration with Existing Channels
```
#general                 ← Main webhook (celebrations)
#admin-alerts           ← Alert webhook (system notifications)
```

## Configuration Examples

### config.json
```json
{
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/123456789/YOUR_CELEBRATION_WEBHOOK_TOKEN",
    "alertwebhookUrl": "https://discord.com/api/webhooks/987654321/YOUR_SYSTEM_ALERT_WEBHOOK_TOKEN",
    "botUsername": "MultiGig Achievements",
    "botAvatarUrl": ""
  }
}
```

### Environment Variables
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/YOUR_CELEBRATION_WEBHOOK_TOKEN
DISCORD_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/987654321/YOUR_SYSTEM_ALERT_WEBHOOK_TOKEN
```

## Message Examples

### Main Webhook Messages
```
🎉 MILESTONE ACHIEVED! 🎉

🏆 WE'VE CROSSED 5TB OF TOTAL DATA! 🏆

📊 Current Stats:
📥 Total Downloaded: 3.2 TB
📤 Total Uploaded: 1.8 TB
📈 Grand Total: 5.0 TB

🎊 Congratulations to the entire MultiGig team! 🎊
```

### System Alert Webhook Messages
```
🟢 MultiGig Bot Started Successfully

📊 Status: Bot is now online and monitoring
🔔 Alerts Loaded: 8 alert(s)
⏰ Schedule: * * * * *
🏥 Health: All systems operational
```

```
⚠️ Database Error

Alert: Daily Performance Winners
Error: Connection timeout to InfluxDB
Status: Alert logic continuing with null data
```

## Testing Your Webhooks

### Test Main Webhook
Send a test message to verify your celebration webhook works:
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🧪 **Test Message** - Main webhook is working!",
    "username": "Test Bot"
  }'
```

### Test System Alert Webhook
Send a test message to verify your system alert webhook works:
```bash
curl -X POST "YOUR_ALERT_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🔧 **System Test** - Alert webhook is working!",
    "username": "System Test"
  }'
```

### Using the Bot's Test Feature
You can also test webhooks using the built-in example alert:
```bash
TEST_WEBHOOK=true npm start
```

This will trigger the `exampleAlert.js` which sends a test message to the main webhook.

## Webhook Security

### Best Practices
- Keep webhook URLs secret (they contain authentication tokens)
- Don't commit webhook URLs to version control
- Use environment variables in production
- Regenerate webhooks if compromised

### Webhook URL Format
```
https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
                                 ^^^^^^^^^^^ ^^^^^^^^^^^^^^
                                 Public ID   Secret Token
```

The webhook token is the secret part - protect it like a password.

## Troubleshooting

### Common Issues

**"Invalid Webhook URL"**
- Check that the URL is complete and correctly formatted
- Ensure no extra spaces or characters
- Verify the webhook hasn't been deleted in Discord

**"Webhook not found"**
- The webhook may have been deleted
- Check Discord channel integrations
- Recreate the webhook if necessary

**"Rate limited"**
- Discord limits webhook calls to prevent spam
- The bot has built-in rate limiting, but check your configuration
- Ensure you're not running multiple instances

**Messages not appearing**
- Check channel permissions
- Verify the webhook URL is correct
- Check Discord server status
- Look for error messages in bot logs

### Testing Connectivity
```bash
# Test if Discord API is reachable
curl -I https://discord.com/api/webhooks/123456789/test

# Should return HTTP 401 (Unauthorized) if reachable
# HTTP 404 means webhook doesn't exist
# Connection errors mean network issues
```

## Permission Requirements

The Discord user creating webhooks needs:
- `Manage Webhooks` permission in the target channel
- `Send Messages` permission in the target channel
- `Use External Emojis` permission (for emoji reactions)

## Integration Tips

### Channel Naming Conventions
- Use descriptive names: `#multigig-achievements`, `#multigig-system`
- Consider using emojis: `🎉-achievements`, `⚠️-system-alerts`
- Keep names short but clear

### Notification Settings
- Configure channel notification settings appropriately
- Celebrations can be normal notifications
- System alerts might warrant higher priority notifications

### Message Formatting
- The bot uses Discord markdown formatting
- Supports bold (**text**), italic (*text*), and code (`text`)
- Uses emojis for visual appeal
- Structures messages with clear headers and sections

## Advanced Configuration

### Custom Bot Appearance
```json
{
  "discord": {
    "botUsername": "MultiGig Achievements",
    "botAvatarUrl": "https://example.com/multigig-avatar.png"
  }
}
```

### Multiple Webhook Setup
If you need more granular control, you can:
1. Modify the bot code to use different webhooks for different alert types
2. Create additional webhooks for specific purposes
3. Use Discord's webhook management features for routing

This setup ensures that fun celebrations don't get mixed up with important system alerts, making it easier to monitor both the achievements and the system health of your MultiGig Bot.