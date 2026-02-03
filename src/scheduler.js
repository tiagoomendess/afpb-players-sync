#!/usr/bin/env node

const cron = require('node-cron');
const { main } = require('./sync-players');

// Store original argv to restore later
const originalArgv = process.argv.slice();

/**
 * AFPB Players Sync Scheduler
 * 
 * Runs full sync automatically on Mondays and Fridays at 22:00
 * Cron expression: '0 22 * * 1,5'
 * - 0: minute 0
 * - 22: hour 22 (10 PM)
 * - *: any day of month
 * - *: any month
 * - 1,5: Monday (1) and Friday (5)
 */

const CRON_SCHEDULE = '0 5 * * 1,5,6';

function getNextRunTimes() {
  const now = new Date();
  const nextRuns = [];
  
  // Find next Monday and Friday at 22:00
  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(22, 0, 0, 0);
    
    const dayOfWeek = date.getDay();
    // Monday = 1, Friday = 5
    if ((dayOfWeek === 1 || dayOfWeek === 5) && date > now) {
      nextRuns.push(date);
      if (nextRuns.length >= 2) break;
    }
  }
  
  return nextRuns;
}

function formatDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[date.getDay()];
  return `${dayName}, ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}

async function runFullSync() {
  console.log('\n' + '='.repeat(60));
  console.log(`🕐 Scheduled sync started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  try {
    // Set up argv for full sync mode
    process.argv = ['node', 'sync-players.js', '--mode', 'full'];
    
    await main();
    
    console.log('\n✅ Scheduled sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Scheduled sync failed:', error.message);
  } finally {
    // Restore original argv
    process.argv = originalArgv;
    
    // Show next scheduled runs
    const nextRuns = getNextRunTimes();
    if (nextRuns.length > 0) {
      console.log('\n📅 Next scheduled runs:');
      nextRuns.forEach((run, index) => {
        console.log(`   ${index + 1}. ${formatDate(run)}`);
      });
    }
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

function startScheduler() {
  console.log('🗓️  AFPB Players Sync Scheduler');
  console.log('================================');
  console.log('');
  console.log(`📋 Schedule: Every Monday and Friday at 22:00`);
  console.log(`   Cron expression: ${CRON_SCHEDULE}`);
  console.log('');
  
  // Validate cron expression
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('❌ Invalid cron expression:', CRON_SCHEDULE);
    process.exit(1);
  }
  
  // Show next scheduled runs
  const nextRuns = getNextRunTimes();
  if (nextRuns.length > 0) {
    console.log('📅 Next scheduled runs:');
    nextRuns.forEach((run, index) => {
      console.log(`   ${index + 1}. ${formatDate(run)}`);
    });
  }
  
  console.log('');
  console.log('⏳ Scheduler is running... Press Ctrl+C to stop.');
  console.log('');
  
  // Schedule the task
  const task = cron.schedule(CRON_SCHEDULE, async () => {
    await runFullSync();
  }, {
    scheduled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use system timezone
  });
  
  // Start the scheduled task
  task.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⚠️  Received SIGINT. Stopping scheduler...');
    task.stop();
    console.log('👋 Scheduler stopped. Goodbye!');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n⚠️  Received SIGTERM. Stopping scheduler...');
    task.stop();
    console.log('👋 Scheduler stopped. Goodbye!');
    process.exit(0);
  });
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🗓️  AFPB Players Sync Scheduler - Help

Usage: node src/scheduler.js [options]

This script runs a cron job that executes 'npm run sync:full' automatically
on Mondays and Fridays at 22:00 (10 PM).

OPTIONS:
  --run-now     Run the full sync immediately, then continue with schedule
  --test        Run the full sync once immediately and exit (for testing)
  --help, -h    Show this help message

EXAMPLES:
  # Start the scheduler (runs in foreground)
  npm run schedule
  node src/scheduler.js

  # Start scheduler and run sync immediately
  node src/scheduler.js --run-now

  # Test the sync without waiting for schedule
  node src/scheduler.js --test

NOTES:
  - The scheduler uses your system's timezone
  - Keep the terminal open for the scheduler to work
  - Use a process manager (PM2, systemd) for production deployment
  - Press Ctrl+C to stop the scheduler

SCHEDULE:
  Cron: ${CRON_SCHEDULE}
  Runs: Every Monday and Friday at 22:00
`);
  process.exit(0);
}

if (args.includes('--test')) {
  console.log('🧪 Test mode: Running full sync once and exiting...');
  runFullSync().then(() => {
    console.log('\n🧪 Test completed. Exiting.');
    process.exit(0);
  });
} else if (args.includes('--run-now')) {
  console.log('🚀 Running full sync immediately, then starting scheduler...');
  runFullSync().then(() => {
    startScheduler();
  });
} else {
  startScheduler();
}

