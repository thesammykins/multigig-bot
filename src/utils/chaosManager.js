#!/usr/bin/env node

/**
 * Chaos Scheduler Management Utility
 *
 * This utility helps monitor and manage the chaos scheduling system.
 * It provides commands to view current state, reset schedules, and test chaos probabilities.
 *
 * Usage:
 *   node src/utils/chaosManager.js stats          # Show chaos scheduling statistics
 *   node src/utils/chaosManager.js reset [alert]  # Reset chaos state (all or specific alert)
 *   node src/utils/chaosManager.js test [alert]   # Test chaos probability for alert
 *   node src/utils/chaosManager.js simulate       # Simulate chaos scheduling over time
 */

const chaosScheduler = require('../services/chaosScheduler');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('='.repeat(60), 'cyan') + '\n');
}

function printStats() {
  printHeader('CHAOS SCHEDULER STATISTICS');

  const stats = chaosScheduler.getStats();

  console.log(colorize('Configuration:', 'yellow'));
  console.log(`  Base Chance: ${colorize((stats.config.baseChance * 100).toFixed(1) + '%', 'green')}`);
  console.log(`  Max Multiplier: ${colorize(stats.config.maxMultiplier + 'x', 'green')}`);
  console.log(`  Max Multiplier Time: ${colorize((stats.config.maxMultiplierTime / (60 * 60 * 1000)) + ' hours', 'green')}`);
  console.log(`  Default Check Interval: ${colorize(stats.config.defaultCheckInterval, 'green')}\n`);

  console.log(colorize('Tracked Alerts:', 'yellow'));
  console.log(`  Total: ${colorize(stats.totalChaosAlerts, 'green')} chaos-scheduled alerts\n`);

  if (stats.executions.length === 0) {
    console.log(colorize('  No chaos executions recorded yet.', 'magenta'));
    return;
  }

  console.log(colorize('Recent Executions (most recent first):', 'yellow'));
  stats.executions.forEach((exec, index) => {
    const nameColor = index === 0 ? 'green' : 'white';
    const chancePercent = (exec.currentChance * 100).toFixed(1);
    const chanceColor = exec.currentChance >= stats.config.baseChance * 2 ? 'red' :
                       exec.currentChance >= stats.config.baseChance * 1.5 ? 'yellow' : 'green';

    console.log(`  ${colorize(exec.alertName, nameColor)}`);
    console.log(`    Last execution: ${exec.hoursAgo} hours ago`);
    console.log(`    Current chance: ${colorize(chancePercent + '%', chanceColor)}`);
    console.log('');
  });
}

function resetChaosState(alertName = null) {
  if (alertName) {
    printHeader(`RESETTING CHAOS STATE: ${alertName.toUpperCase()}`);
    chaosScheduler.resetChaosState(alertName);
    console.log(colorize(`✅ Reset chaos state for "${alertName}"`, 'green'));
  } else {
    printHeader('RESETTING ALL CHAOS STATE');
    console.log(colorize('⚠️  This will reset all chaos scheduling state!', 'yellow'));
    console.log('Are you sure? This will affect all chaos-scheduled alerts.');
    console.log('Type "yes" to confirm, or anything else to cancel:');

    // Simple synchronous input for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('> ', (answer) => {
      if (answer.toLowerCase() === 'yes') {
        chaosScheduler.resetChaosState();
        console.log(colorize('✅ All chaos scheduling state has been reset!', 'green'));
      } else {
        console.log(colorize('❌ Reset cancelled.', 'red'));
      }
      rl.close();
    });
    return;
  }
}

function testChaosAlert(alertName) {
  if (!alertName) {
    console.log(colorize('❌ Please specify an alert name to test', 'red'));
    console.log('Usage: node chaosManager.js test "Alert Name"');
    return;
  }

  printHeader(`TESTING CHAOS PROBABILITY: ${alertName.toUpperCase()}`);

  const stats = chaosScheduler.getStats();
  const alertExecution = stats.executions.find(exec => exec.alertName === alertName);

  if (!alertExecution) {
    console.log(colorize(`⚠️  No execution history found for "${alertName}"`, 'yellow'));
    console.log('This alert either hasn\'t run yet or isn\'t using chaos scheduling.\n');
  } else {
    console.log(colorize('Current State:', 'yellow'));
    console.log(`  Last execution: ${alertExecution.hoursAgo} hours ago`);
    console.log(`  Current chance: ${colorize((alertExecution.currentChance * 100).toFixed(1) + '%', 'green')}\n`);
  }

  console.log(colorize('Testing chaos probability...', 'yellow'));

  let successes = 0;
  const trials = 1000;

  for (let i = 0; i < trials; i++) {
    if (chaosScheduler.shouldChaosAlertRun(alertName)) {
      successes++;
    }
  }

  const actualPercentage = (successes / trials * 100).toFixed(1);
  const expectedPercentage = alertExecution ?
    (alertExecution.currentChance * 100).toFixed(1) :
    (stats.config.baseChance * 100).toFixed(1);

  console.log(`\nTest Results (${trials} trials):`);
  console.log(`  Expected probability: ${colorize(expectedPercentage + '%', 'green')}`);
  console.log(`  Actual probability: ${colorize(actualPercentage + '%', 'blue')}`);
  console.log(`  Difference: ${colorize(Math.abs(actualPercentage - expectedPercentage).toFixed(1) + '%', 'magenta')}`);

  if (Math.abs(actualPercentage - expectedPercentage) < 2) {
    console.log(colorize('✅ Probability test passed! Chaos scheduling is working correctly.', 'green'));
  } else {
    console.log(colorize('⚠️  Large difference detected. This could be normal statistical variance.', 'yellow'));
  }
}

function simulateChaos() {
  printHeader('CHAOS SCHEDULING SIMULATION');

  console.log(colorize('Simulating chaos scheduling over 24 hours...', 'yellow'));
  console.log('This shows when a hypothetical alert would fire based on chaos probability.\n');

  const hoursToSimulate = 24;
  const checkIntervalMinutes = 15; // Default check interval
  const checksPerHour = 60 / checkIntervalMinutes;
  const totalChecks = hoursToSimulate * checksPerHour;

  let lastExecution = 0;
  const executions = [];

  for (let check = 0; check < totalChecks; check++) {
    const currentTime = check * checkIntervalMinutes;
    const timeSinceLastExecution = currentTime - lastExecution;

    // Simulate the chaos probability calculation
    const stats = chaosScheduler.getStats();
    const timeMultiplier = Math.min(
      timeSinceLastExecution / (3 * 60), // 3 hours in minutes
      stats.config.maxMultiplier
    );

    const currentChance = stats.config.baseChance * Math.max(1, timeMultiplier);
    const shouldRun = Math.random() < currentChance;

    if (shouldRun) {
      executions.push({
        time: currentTime,
        timeSinceLastMinutes: timeSinceLastExecution,
        probability: (currentChance * 100).toFixed(1)
      });
      lastExecution = currentTime;
    }
  }

  console.log(colorize('Simulation Results:', 'yellow'));
  console.log(`  Time period: ${hoursToSimulate} hours`);
  console.log(`  Check frequency: every ${checkIntervalMinutes} minutes`);
  console.log(`  Total executions: ${colorize(executions.length, 'green')}`);
  console.log(`  Average interval: ${colorize((hoursToSimulate * 60 / executions.length).toFixed(1) + ' minutes', 'blue')}\n`);

  console.log(colorize('Execution Timeline:', 'yellow'));
  executions.forEach((exec, index) => {
    const hours = Math.floor(exec.time / 60);
    const minutes = exec.time % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const intervalStr = index === 0 ? 'First execution' : `${exec.timeSinceLastMinutes}m since last`;

    console.log(`  ${colorize(timeStr, 'green')} - ${intervalStr} (${exec.probability}% chance)`);
  });

  console.log(colorize('\n💡 This simulation shows the beautiful unpredictability of chaos scheduling!', 'magenta'));
}

function showUsage() {
  console.log(colorize('\nChaos Scheduler Management Utility', 'bright'));
  console.log(colorize('===================================', 'cyan'));
  console.log('\nUsage:');
  console.log('  node chaosManager.js stats                    # Show current statistics');
  console.log('  node chaosManager.js reset                    # Reset all chaos state');
  console.log('  node chaosManager.js reset "Alert Name"      # Reset specific alert');
  console.log('  node chaosManager.js test "Alert Name"       # Test chaos probability');
  console.log('  node chaosManager.js simulate                # Simulate chaos over 24h');
  console.log('\nExamples:');
  console.log('  node chaosManager.js stats');
  console.log('  node chaosManager.js reset "Digital Sentinel Status Report"');
  console.log('  node chaosManager.js test "Chaos Scheduling Example"');
  console.log('  node chaosManager.js simulate\n');
}

// Main command processing
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const alertName = args[1];

  switch (command) {
    case 'stats':
      printStats();
      break;

    case 'reset':
      resetChaosState(alertName);
      break;

    case 'test':
      testChaosAlert(alertName);
      break;

    case 'simulate':
      simulateChaos();
      break;

    default:
      showUsage();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  printStats,
  resetChaosState,
  testChaosAlert,
  simulateChaos,
  showUsage
};
