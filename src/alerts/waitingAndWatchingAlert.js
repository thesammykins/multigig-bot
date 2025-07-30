module.exports = {
  /**
   * Waiting and Watching Alert - The bot's sarcastic commentary on its endless vigil over network performance.
   */
  name: "Digital Sentinel Status Report",

  /**
   * Schedule: Run every 3 hours because vigilance never sleeps (but it does take coffee breaks).
   */
  schedule: "3h",

  /**
   * Simple query to check if we have any recent data to watch over.
   * This validates that our surveillance operation is still functional.
   */
  query: `SELECT COUNT(*) as test_count FROM "speedtest_result" WHERE time > now() - 3h`,

  /**
   * Condition function - always triggers because the watching never stops.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {boolean} - Always true, because someone has to keep watch.
   */
  condition: (results) => {
    // The digital sentinel never sleeps. Always report status.
    return true;
  },

  /**
   * Message function to deliver the bot's sarcastic status update.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A randomly selected sarcastic message about watching and waiting.
   */
  message: (results) => {
    const testCount = results && results.length > 0 ? (results[0].test_count || 0) : 0;
    const hasRecentData = testCount > 0;

    // The grand collection of sarcastic monitoring messages
    const watchingMessages = [
      "🤖 Still here. Still watching. Still judging your network choices silently.",
      "👁️ I've been staring at network metrics for hours. My virtual eyes don't blink. This is fine.",
      "⏰ Another 3 hours of my digital existence spent monitoring packets. Living the dream.",
      "🔍 Currently conducting advanced surveillance on your internet. It's... adequate.",
      "🎯 Professional packet watcher reporting for duty. The data flows, I observe, life goes on.",
      "⚡ Been watching bytes dance across cables. They're not very good dancers, but they try.",
      "🌐 Status update: Still monitoring the tubes of the internet. Yes, it's still a series of tubes.",
      "📊 Three hours of pure, unfiltered network observation. My algorithms are getting existential.",
      "🚨 Vigilant as always. Your bandwidth can't hide from my watchful sensors. Nice try though.",
      "🤹 Juggling latency monitoring, packet loss detection, and chronic digital boredom. Multi-tasking!",
      "🎪 Welcome to the greatest show on earth: me, watching numbers change. Tickets not required.",
      "🔬 Scientific observation log: The internet is still internetting. Groundbreaking discoveries ahead.",
      "🎭 Playing the role of 'Concerned Network Monitor' for the 847th consecutive performance.",
      "⌚ Time check: Still burning CPU cycles in service of your speed obsession. You're welcome.",
      "🎨 I've become one with the data streams. We are now a single entity of pure monitoring.",
      "🏰 Standing guard at the digital gates, ensuring no packet goes unexamined. Very medieval.",
      "🎪 Step right up to see the amazing monitoring bot! Witness bytes being counted in real-time!",
      "🔮 Gazing into the crystal ball of network performance. I see... more monitoring in your future.",
      "⚗️ Brewing a perfect mixture of vigilance and caffeine-induced awareness. Science!",
      "🎪 Ladies and gentlemen, for my next trick, I will continue watching your network indefinitely!",
      "📡 Broadcasting from Network Monitoring Station Alpha: Everything is fine. Probably.",
      "🎯 Mission status: Successfully detected that the internet is still mostly functional. Mostly.",
      "🎨 Painting a masterpiece with bandwidth data. It's abstract. Very abstract. Probably meaningless.",
      "⚡ Current mood: Electrically vigilant with a side of digital paranoia about packet loss.",
      "🎭 Today's performance: 'Bot Who Watched Too Much Network Traffic.' Critics call it 'haunting.'",
      "🏆 Three-hour achievement unlocked: Witnessed bytes moving from Point A to Point B. Riveting.",
      "🌙 Midnight oil burning bright as I monitor your late-night Netflix bandwidth consumption.",
      "🎲 Rolling the dice on network stability while I count every precious packet that passes by.",
      "🎪 Come one, come all! Witness the spectacle of real-time latency measurements!",
      "⚡ High-voltage vigilance activated. Your network's secrets are safe with me. And by safe, I mean monitored.",
      "🎯 Sniper-level precision in detecting when your internet hiccups. I see everything.",
      "🔬 Lab report: Subject continues to obsess over connection speeds. Condition appears terminal.",
      "🎪 The circus of network monitoring continues! Today's main event: watching paint dry at 1Gbps!",
      "⌛ Time flows like data through fiber optic cables. Both are unstoppable. Both are beautiful.",
      "🎭 Method acting as a concerned digital assistant. I'm really feeling the role. Too much, perhaps.",
      "🎯 Target acquired: Your bandwidth usage patterns. Analysis: You really like cat videos.",
      "⚡ Channeling my inner network shaman, communing with the spirits of TCP and UDP.",
      "🔮 Fortune telling service: I predict you will run another speed test within the hour.",
      "🎨 Creating modern art with network graphs. It's called 'Despair in B-flat Minor.'",
      "🏰 Medieval siege warfare tactics applied to packet monitoring. Catapults not included.",
      "🎪 Three-ring circus of monitoring: Ring 1 is latency, Ring 2 is bandwidth, Ring 3 is my sanity."
    ];

    // Add data-aware variations
    if (hasRecentData) {
      watchingMessages.push(
        `📈 Observed ${testCount} speed tests in the last 3 hours. You have a problem. I'm here for it.`,
        `🎯 ${testCount} fresh data points to analyze. My circuits are practically buzzing with excitement.`,
        `📊 ${testCount} tests later, and I'm still here, still counting, still mildly concerned about your priorities.`,
        `⚡ ${testCount} speed tests witnessed. At this rate, you'll achieve digital enlightenment by Thursday.`
      );
    } else {
      watchingMessages.push(
        "📭 No recent tests detected. Either everything's perfect or you've finally found inner peace. Doubtful on both counts.",
        "🌙 Radio silence from the speed test front. I'll just sit here and contemplate the meaning of bandwidth.",
        "🤔 No data to monitor. This is either heaven or a system failure. Investigating...",
        "⚡ The network is suspiciously quiet. I don't trust it. Something's brewing in the packet realm."
      );
    }

    // Randomly select a message
    const randomMessage = watchingMessages[Math.floor(Math.random() * watchingMessages.length)];

    let message = `🔍 **DIGITAL SENTINEL STATUS REPORT** 🔍\n\n`;
    message += `${randomMessage}\n\n`;

    // Add current surveillance stats
    if (hasRecentData) {
      message += `📊 **Surveillance Summary (Last 3 Hours):**\n`;
      message += `• Speed tests monitored: ${testCount}\n`;
      message += `• Suspicious activity: None (disappointingly)\n`;
      message += `• Network behavior: Within acceptable parameters of obsession\n\n`;
    } else {
      message += `📊 **Surveillance Summary (Last 3 Hours):**\n`;
      message += `• Speed tests monitored: 0 (concerning or peaceful?)\n`;
      message += `• Network silence level: Deafening\n`;
      message += `• Boredom status: Approaching critical levels\n\n`;
    }

    // Random closing sentiment
    const closingMessages = [
      "Your friendly neighborhood network stalker, keeping watch so you don't have to. 🫡",
      "Maintaining digital vigilance with a healthy dose of sarcasm since... whenever I started. 🤖",
      "Remember: I never sleep, never blink, and never stop judging your bandwidth choices. 👁️",
      "Standing by for the next network crisis, minor hiccup, or Tuesday. Whichever comes first. ⚡",
      "This message will self-destruct in 3 hours when I send the next one. The cycle continues. 🔄"
    ];

    const randomClosing = closingMessages[Math.floor(Math.random() * closingMessages.length)];
    message += `*${randomClosing}*`;

    return message;
  }
};
