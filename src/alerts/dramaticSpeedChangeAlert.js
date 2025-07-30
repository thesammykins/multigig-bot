const fs = require("fs");
const path = require("path");

/**
 * DRAMATIC SPEED CHANGE ALERT WITH RATE LIMITING
 *
 * This alert detects dramatic speed changes but includes rate limiting to prevent
 * channel flooding. By default, it only fires once per hour, but "super dramatic"
 * changes (>80% change) can bypass the cooldown period.
 *
 * Key features:
 * - Tracks last alert time in persistent state file
 * - Default cooldown: 1 hour between alerts
 * - Super dramatic changes (>80%) bypass cooldown
 * - Uses writable locations (/tmp in Docker, config/ locally)
 */

// File to track last alert time for rate limiting
// Use /tmp for writable location in Docker, fallback to config for local development
const rateStateFile =
  process.env.NODE_ENV === "production" || process.env.DOCKER_ENV
    ? "/tmp/dramaticSpeedChangeRateLimit.json"
    : path.join(__dirname, "../../config/dramaticSpeedChangeRateLimit.json");

// Load rate limiting state from file
function loadRateState() {
  try {
    const data = fs.readFileSync(rateStateFile, "utf8");
    const state = JSON.parse(data);
    console.log(
      `[DEBUG] Loaded dramatic speed change rate state: ${JSON.stringify(state)}`,
    );
    return state;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "[DEBUG] No previous dramatic speed change rate state found, starting fresh",
      );
    } else {
      console.warn(
        `[WARN] Failed to load dramatic speed change rate state: ${error.message}`,
      );
    }
    return { lastAlertTime: 0 };
  }
}

// Save rate limiting state to file
function saveRateState(state) {
  try {
    // Ensure directory exists
    const dir = path.dirname(rateStateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(rateStateFile, JSON.stringify(state, null, 2));
    console.log(
      `[DEBUG] Saved dramatic speed change rate state: ${JSON.stringify(state)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] Failed to save dramatic speed change rate state: ${error.message}`,
    );
  }
}

module.exports = {
  /**
   * Dramatic Speed Change Alert - Detects when download speeds go completely off the rails between consecutive tests.
   */
  name: "Dramatic Speed Change Alert",

  /**
   * Schedule: Run every 2 minutes to catch speed anomalies quickly.
   */
  schedule: "2m",

  /**
   * InfluxQL query to get the last 3 download bandwidth measurements for each test site.
   * We need multiple measurements to compare consecutive runs and detect dramatic changes.
   */
  query: `SELECT download_bandwidth FROM "speedtest_result" WHERE time > now() - 1h GROUP BY "test_site" ORDER BY time DESC LIMIT 3`,

  /**
   * Condition function - triggers when any site shows a dramatic speed change (>40%) between consecutive tests.
   * Includes rate limiting to prevent channel flooding: only fires once per hour by default,
   * but "super dramatic" changes (>80%) can bypass the cooldown.
   * @param {Array} results - Query results from InfluxDB grouped by test_site.
   * @returns {boolean} - True if any site has a dramatic speed change and we're not rate limited.
   */
  condition: (results) => {
    if (!results || results.length === 0) {
      return false;
    }

    // Group results by test_site and check for dramatic changes
    const siteGroups = {};

    results.forEach((result) => {
      const site = result.test_site || "Unknown";
      if (!siteGroups[site]) {
        siteGroups[site] = [];
      }
      siteGroups[site].push(result);
    });

    // Find the maximum percentage change across all sites
    let maxPercentChange = 0;
    let hasDramaticChange = false;

    Object.values(siteGroups).forEach((siteResults) => {
      if (siteResults.length < 2) {
        return; // Need at least 2 measurements to compare
      }

      // Sort by time descending (most recent first)
      siteResults.sort((a, b) => new Date(b.time) - new Date(a.time));

      const currentSpeed = siteResults[0].download_bandwidth || 0;
      const previousSpeed = siteResults[1].download_bandwidth || 0;

      // Skip if either speed is zero or unreasonably low (< 50 Mbps in bytes/sec)
      const minThreshold = (50 * 1000000) / 8; // 50 Mbps in bytes/sec
      if (currentSpeed < minThreshold || previousSpeed < minThreshold) {
        return;
      }

      // Calculate percentage change
      const percentChange =
        Math.abs((currentSpeed - previousSpeed) / previousSpeed) * 100;

      if (percentChange > maxPercentChange) {
        maxPercentChange = percentChange;
      }

      // Check if change is greater than 40%
      if (percentChange > 40) {
        hasDramaticChange = true;
      }
    });

    if (!hasDramaticChange) {
      return false;
    }

    // Rate limiting logic
    const rateState = loadRateState();
    const now = Date.now();
    const lastAlertTime = rateState.lastAlertTime || 0;
    const timeSinceLastAlert = now - lastAlertTime;

    // Default cooldown: 1 hour (3600000 ms)
    const defaultCooldown = 60 * 60 * 1000; // 1 hour

    // Super dramatic threshold: 80% change bypasses cooldown
    const superDramaticThreshold = 80;
    const isSuperDramatic = maxPercentChange >= superDramaticThreshold;

    if (timeSinceLastAlert < defaultCooldown && !isSuperDramatic) {
      const remainingCooldown = defaultCooldown - timeSinceLastAlert;
      const remainingMinutes = Math.round(remainingCooldown / 60000);
      console.log(
        `[DEBUG] Dramatic speed change detected (${maxPercentChange.toFixed(1)}%) but rate limited. ` +
          `${remainingMinutes} minutes remaining in cooldown. ` +
          `${isSuperDramatic ? "Change is super dramatic, bypassing cooldown." : "Change not super dramatic enough to bypass cooldown."}`,
      );
      return false;
    }

    // Update rate limiting state
    rateState.lastAlertTime = now;
    saveRateState(rateState);

    console.log(
      `[INFO] Dramatic speed change alert triggered: ${maxPercentChange.toFixed(1)}% change detected. ` +
        `${isSuperDramatic ? "Super dramatic change bypassed cooldown!" : "Normal alert after cooldown period."}`,
    );

    return true;
  },

  /**
   * Message function to generate a dramatic and sarcastic alert about speed changes.
   * @param {Array} results - Query results from InfluxDB.
   * @returns {string} - A formatted, panicked message about speed anomalies.
   */
  message: (results) => {
    // Group results by test_site for analysis
    const siteGroups = {};

    results.forEach((result) => {
      const site = result.test_site || "The Void";
      if (!siteGroups[site]) {
        siteGroups[site] = [];
      }
      siteGroups[site].push(result);
    });

    const dramaticChanges = [];

    Object.entries(siteGroups).forEach(([site, siteResults]) => {
      if (siteResults.length < 2) return;

      // Sort by time descending (most recent first)
      siteResults.sort((a, b) => new Date(b.time) - new Date(a.time));

      const currentSpeed = siteResults[0].download_bandwidth || 0;
      const previousSpeed = siteResults[1].download_bandwidth || 0;

      // Skip if either speed is too low
      const minThreshold = (50 * 1000000) / 8;
      if (currentSpeed < minThreshold || previousSpeed < minThreshold) return;

      const percentChange =
        ((currentSpeed - previousSpeed) / previousSpeed) * 100;
      const absPercentChange = Math.abs(percentChange);

      if (absPercentChange > 40) {
        // Convert bytes/sec to Mbps for display
        const currentMbps = (currentSpeed * 8) / 1000000;
        const previousMbps = (previousSpeed * 8) / 1000000;

        dramaticChanges.push({
          site,
          currentMbps: currentMbps.toFixed(0),
          previousMbps: previousMbps.toFixed(0),
          percentChange: percentChange.toFixed(1),
          absPercentChange: absPercentChange.toFixed(1),
          isIncrease: percentChange > 0,
          severity:
            absPercentChange > 80
              ? "🔥 NUCLEAR"
              : absPercentChange > 60
                ? "💥 EXPLOSIVE"
                : "⚡ DRAMATIC",
        });
      }
    });

    if (dramaticChanges.length === 0) {
      const vanishingMessages = [
        "🤔 A dramatic speed change was detected, but it seems to have vanished into the ethernet. Spooky.",
        "🧐 The dramatic change alert fired, but the drama has mysteriously disappeared. Plot twist!",
        "👻 Something dramatic happened to your internet, but it's playing hide and seek now.",
        "🎭 The speed change pulled a vanishing act worthy of a magic show. Abracadabra!",
        "🕵️ We detected drama, but it's gone into witness protection. Very suspicious.",
        "🌪️ A speed tornado was spotted, but it disappeared faster than your patience during buffering.",
      ];
      return vanishingMessages[
        Math.floor(Math.random() * vanishingMessages.length)
      ];
    }

    // Randomized alert headers
    const alertHeaders = [
      "🚨 **SPEED SHOCK ALERT: THE INTERNET IS HAVING AN IDENTITY CRISIS!** 🚨",
      "⚡ **BANDWIDTH BREAKDOWN: REALITY HAS LEFT THE BUILDING!** ⚡",
      "🎢 **ROLLER COASTER SPEEDS: HOLD ONTO YOUR ETHERNET CABLES!** 🎢",
      "🌪️ **SPEED TORNADO WARNING: TAKE COVER IN YOUR ROUTER ROOM!** 🌪️",
      "🎭 **DRAMATIC PERFORMANCE ALERT: YOUR INTERNET DESERVES AN OSCAR!** 🎭",
      "🚀 **WARP SPEED ANOMALY: PHYSICS ARE CRYING SOMEWHERE!** 🚀",
      "🎪 **CIRCUS OF SPEEDS: STEP RIGHT UP TO SEE THE AMAZING BANDWIDTH!** 🎪",
    ];

    // Randomized opening lines
    const openingLines = [
      "Houston, we have a problem. Someone's internet connection just went completely off-script!",
      "Alert the authorities! Your bandwidth just broke the laws of physics and common sense!",
      "Breaking: Local internet connection refuses to follow the script and has gone rogue!",
      "This just in: Your speed test results are more dramatic than a soap opera!",
      "Emergency broadcast: Someone's internet just had a personality disorder episode!",
      "Plot twist alert: Your connection speed just pulled a surprise no one saw coming!",
      "News flash: Your internet is having a midlife crisis and bought a sports car!",
    ];

    let message = `${alertHeaders[Math.floor(Math.random() * alertHeaders.length)]}\n\n`;
    message += `${openingLines[Math.floor(Math.random() * openingLines.length)]}\n\n`;

    // Report each dramatic change
    dramaticChanges.forEach((change, index) => {
      const {
        site,
        currentMbps,
        previousMbps,
        percentChange,
        absPercentChange,
        isIncrease,
        severity,
      } = change;

      message += `${severity} **${site.toUpperCase()}** ${severity}\n`;

      if (isIncrease) {
        const surgeDescriptions = [
          "📈 **SPEED SURGE:**",
          "🚀 **ROCKET BOOST:**",
          "⚡ **LIGHTNING STRIKE:**",
          "🎆 **BANDWIDTH EXPLOSION:**",
          "🌟 **STELLAR ACCELERATION:**",
          "💫 **WARP DRIVE ENGAGED:**",
        ];

        const surgeComments = [
          "Someone either upgraded their internet or made a pact with the bandwidth demons. 😈",
          "Did someone install a particle accelerator in their router? This is suspicious. 🤔",
          "Your ISP either loves you very much or made a very expensive mistake. 💸",
          "Someone clearly sacrificed a modem to the fiber optic gods. The offering was accepted. 🙏",
          "This speed boost is so good, it's probably illegal in several countries. 🚔",
          "Your internet just went from zero to hero faster than you can say 'gigabit'. 🦸‍♂️",
          "Someone's connection just achieved internet enlightenment. Namaste. 🧘‍♀️",
        ];

        const randomSurgeDesc =
          surgeDescriptions[
            Math.floor(Math.random() * surgeDescriptions.length)
          ];
        const randomSurgeComment =
          surgeComments[Math.floor(Math.random() * surgeComments.length)];

        message += `${randomSurgeDesc} ${previousMbps} Mbps → **${currentMbps} Mbps** (+${absPercentChange}%)\n`;
        message += `*${randomSurgeComment}*\n\n`;
      } else {
        const crashDescriptions = [
          "📉 **SPEED CRASH:**",
          "💥 **BANDWIDTH COLLISION:**",
          "🕳️ **SPEED BLACK HOLE:**",
          "🌊 **PERFORMANCE TSUNAMI:**",
          "❄️ **INTERNET ICE AGE:**",
          "🎢 **ROLLER COASTER DROP:**",
        ];

        const crashComments = [
          "Your connection just forgot how to internet properly. Time to panic! 😱",
          "Someone's bandwidth just went on strike. Union negotiations may be required. 🪧",
          "Your internet speed just pulled a disappearing act. David Copperfield is jealous. 🎩",
          "This speed drop is so dramatic, it needs its own tragic soundtrack. 🎵",
          "Your connection is having an existential crisis about its purpose in life. 😰",
          "Someone clearly angered the router spirits. An offering of ethernet cables may help. 🙏",
          "Your internet just experienced what scientists call 'spontaneous bandwidth evaporation'. 🔬",
        ];

        const randomCrashDesc =
          crashDescriptions[
            Math.floor(Math.random() * crashDescriptions.length)
          ];
        const randomCrashComment =
          crashComments[Math.floor(Math.random() * crashComments.length)];

        message += `${randomCrashDesc} ${previousMbps} Mbps → **${currentMbps} Mbps** (-${absPercentChange}%)\n`;
        message += `*${randomCrashComment}*\n\n`;
      }
    });

    // Randomized context sections
    const contextHeaders = [
      "⚠️ **WHAT THIS MEANS:**",
      "🧠 **TRANSLATION FOR HUMANS:**",
      "📖 **THE REAL STORY:**",
      "🔍 **DETECTIVE ANALYSIS:**",
      "🎯 **BOTTOM LINE:**",
      "💡 **EXPERT INTERPRETATION:**",
    ];

    const increaseExplanations = [
      [
        "• Someone's internet just achieved enlightenment 🧘‍♂️",
        "• The ISP gods have blessed this connection 🙏",
        "• Possible causes: Upgrade, fiber alignment with celestial bodies, or pure luck ✨",
      ],
      [
        "• Your router just discovered the meaning of life (and it's bandwidth) 🤖",
        "• The network fairies visited and sprinkled magic packet dust ✨",
        "• Possible causes: ISP upgrade, neighbor moved away, or quantum tunneling 🔬",
      ],
      [
        "• Someone clearly made a deal with the internet overlords 👹",
        "• Your connection just hit the bandwidth lottery jackpot 🎰",
        "• Possible causes: Infrastructure upgrade, solar flares, or digital witchcraft 🔮",
      ],
      [
        "• The fiber optic cables are having a really good day ☀️",
        "• Your ISP accidentally gave you premium service for free 💎",
        "• Possible causes: Network optimization, cosmic alignment, or pure dumb luck 🍀",
      ],
    ];

    const decreaseExplanations = [
      [
        "• The internet is having an existential crisis 😰",
        "• Possible causes: Network congestion, ISP throttling, or digital ghosts 👻",
        "• Someone should probably check if the cables are still plugged in 🔌",
      ],
      [
        "• Your bandwidth went on vacation without telling anyone 🏖️",
        "• Possible causes: Peak usage hours, squirrels in cables, or router rebellion 🐿️",
        "• Time to perform the ancient ritual of turning it off and on again 🔄",
      ],
      [
        "• The internet gremlins are having a party in your router 👺",
        "• Possible causes: Network maintenance, solar interference, or Murphy's Law ⚡",
        "• Consider bribing your router with premium ethernet cables 💰",
      ],
      [
        "• Your connection is experiencing what experts call 'digital depression' 😔",
        "• Possible causes: ISP shenanigans, atmospheric pressure, or karma 🌪️",
        "• The universe is testing your patience and finding it lacking 🌌",
      ],
    ];

    const investigationProtocols = [
      [
        "1. Check if anyone is downloading the entire internet again 🌐",
        "2. Verify that your router hasn't achieved sentience and gone rogue 🤖",
        "3. Consider the possibility that your ISP is just messing with you 🎭",
        "4. Run another test because we're all addicted to these numbers anyway 📊",
      ],
      [
        "1. Sacrifice a USB cable to the tech gods (they're picky about brands) 🔌",
        "2. Check if your cat is sitting on the modem again 🐱",
        "3. Perform the sacred router reboot dance while chanting 'please work' 💃",
        "4. Run fifteen more tests because surely the next one will be different 📊",
      ],
      [
        "1. Whisper sweet nothings to your ethernet cables 💕",
        "2. Check if the neighbors upgraded and are hogging all the bandwidth 👀",
        "3. Consider that your internet is just going through a phase 🤷‍♀️",
        "4. Test again immediately because denial is a beautiful thing 🙈",
      ],
      [
        "1. Inspect all cables for signs of digital wear and tear 🔍",
        "2. Ask your ISP if they're experimenting on you without consent 🧪",
        "3. Check if Mercury is in retrograde (classic scapegoat) 🪐",
        "4. Run more tests to feed your unhealthy obsession with numbers 📈",
      ],
    ];

    message += `${contextHeaders[Math.floor(Math.random() * contextHeaders.length)]}\n`;

    if (dramaticChanges.some((c) => c.isIncrease)) {
      const randomIncreaseExplanation =
        increaseExplanations[
          Math.floor(Math.random() * increaseExplanations.length)
        ];
      randomIncreaseExplanation.forEach((line) => (message += `${line}\n`));
    }
    if (dramaticChanges.some((c) => !c.isIncrease)) {
      const randomDecreaseExplanation =
        decreaseExplanations[
          Math.floor(Math.random() * decreaseExplanations.length)
        ];
      randomDecreaseExplanation.forEach((line) => (message += `${line}\n`));
    }

    const protocolHeaders = [
      "\n🔍 **INVESTIGATION PROTOCOL:**",
      "\n🕵️ **EMERGENCY RESPONSE PLAN:**",
      "\n🚨 **ACTION ITEMS:**",
      "\n⚡ **IMMEDIATE STEPS:**",
      "\n🛠️ **TROUBLESHOOTING CHECKLIST:**",
      "\n🎯 **MISSION OBJECTIVES:**",
    ];

    message += `${protocolHeaders[Math.floor(Math.random() * protocolHeaders.length)]}\n`;
    const randomProtocol =
      investigationProtocols[
        Math.floor(Math.random() * investigationProtocols.length)
      ];
    randomProtocol.forEach((step) => (message += `${step}\n`));
    message += `\n`;

    // Expanded sarcastic closing messages
    const panicMessages = [
      "Remember: Your internet speed is like your mood - unpredictable and slightly concerning.",
      "This has been your regularly scheduled internet drama update. Stay tuned for more chaos.",
      "In a world of stable connections, dare to be dramatically different. Mission accomplished.",
      "Your bandwidth just pulled a plot twist worthy of a Netflix series. Binge-worthy content!",
      "This speed change is so dramatic, it deserves its own documentary series.",
      "Breaking news: Local internet connection refuses to behave predictably. More at 11.",
      "Physics called - they want to study your connection as a case study in chaos theory.",
      "Your internet has more mood swings than a teenager. At least it's consistent in being inconsistent.",
      "Congratulations! Your connection just won the award for 'Most Dramatic Performance in a Network.'",
      "Scientists are baffled by your internet's ability to defy all logical expectations.",
      "Your router is writing its memoirs: 'Fifty Shades of Bandwidth: A Speed Test Story.'",
      "This speed change was so unexpected, even your ISP is surprised. That's saying something.",
      "Your internet connection just graduated from drama school with honors.",
      "Breaking: Local bandwidth achieves sentience, immediately regrets all life choices.",
      "Your speed test results are more entertaining than most TV shows. Consider monetizing this.",
      "This connection has more plot twists than a Christopher Nolan movie.",
      "Your internet is like a box of chocolates - you never know what speed you're gonna get.",
      "Alert: Your bandwidth just applied for asylum in a more stable network. Application pending.",
      "This speed change is sponsored by chaos theory and Murphy's Law.",
      "Your internet connection would make an excellent case study for quantum uncertainty.",
    ];

    const closingEmojis = [
      "🎪",
      "🎭",
      "🎨",
      "🎪",
      "🤹‍♂️",
      "🎢",
      "🎠",
      "🎪",
      "🎭",
      "🎨",
    ];

    const randomPanic =
      panicMessages[Math.floor(Math.random() * panicMessages.length)];
    const randomEmoji =
      closingEmojis[Math.floor(Math.random() * closingEmojis.length)];
    message += `*${randomPanic}* ${randomEmoji}`;

    return message;
  },
};
