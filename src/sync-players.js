#!/usr/bin/env node

const PlayerSyncService = require('./services/playerSyncService');
const config = require('./config');

async function main() {
  console.log('🎯 AFPB Player Sync Tool');
  console.log('========================');
  
  const startTime = Date.now();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    
    console.log('Configuration:', {
      // API options
      startPage: options.startPage,
      maxPages: options.maxPages,
      batchSize: options.batchSize,
      saveIncremental: options.saveIncremental,
      outputFile: options.outputFile,
      // Web scraping options
      enableWebScraping: options.enableWebScraping,
      scrapingMaxClubs: options.scrapingMaxClubs,
      scrapingOutputFile: options.scrapingOutputFile,
      scrapingConcurrency: options.scrapingConcurrency,
      mode: options.mode,
      // Sync options
      updateConcurrency: options.updateConcurrency
    });

    // Initialize the sync service
    const syncService = new PlayerSyncService({
      updateConcurrency: options.updateConcurrency,
      scrapingConcurrency: options.scrapingConcurrency,
      matching: {
        minMatchScore: options.minMatchScore,
        nameThreshold: options.nameThreshold,
        nicknameThreshold: options.nicknameThreshold,
        nameWeight: options.nameWeight,
        nicknameWeight: options.nicknameWeight,
        clubWeight: options.clubWeight,
        yearWeight: options.yearWeight,
        maxYearDifference: options.maxYearDifference,
        yearDiffPenalty: options.yearDiffPenalty,
        minNameScore: options.minNameScore,
        debug: options.debugMatching
      }
    });

    if (options.mode === 'full') {
      const result = await syncService.performFullSync({
        // API options
        apiStartPage: options.startPage,
        apiMaxPages: options.maxPages,
        apiBatchSize: options.batchSize,
        apiSaveIncremental: options.saveIncremental,
        apiOutputFile: options.outputFile,
        // Web scraping options
        enableWebScraping: options.enableWebScraping,
        scrapingMaxClubs: options.scrapingMaxClubs,
        scrapingSkipClubs: options.scrapingSkipClubs,
        scrapingSaveIncremental: options.saveIncremental,
        scrapingOutputFile: options.scrapingOutputFile
      });

      // Display summary
      console.log('\n📊 Full Sync Summary:');
      const summary = syncService.getPlayersSummary();
      console.log(`   Total players: ${summary.total}`);
      console.log(`   Players with pictures: ${summary.withPictures}`);
      console.log(`   Players without pictures: ${summary.withoutPictures}`);
      console.log(`   Total clubs: ${summary.clubs}`);
      if (summary.ageRange && summary.ageRange.min && summary.ageRange.max) {
        console.log(`   Age range: ${summary.ageRange.min} - ${summary.ageRange.max}`);
      }

    } else if (options.mode === 'match') {
      // Player matching mode
      console.log('\n🎯 Player matching mode - comparing website and AFPB data');
      const result = await syncService.performPlayerMatching({
        websitePlayersFile: options.websitePlayersFile,
        scrapedPlayersFile: options.scrapedPlayersFile,
        outputFile: options.matchingOutputFile,
        loadWebsiteData: !options.skipLoadWebsite,
        loadScrapedData: !options.skipLoadScraped
      });

      // Display summary
      console.log('\n📊 Matching Summary:');
      const stats = result.stats;
      console.log(`   Total matches found: ${stats.total_matches}`);
      console.log(`   Players needing club updates: ${stats.club_changes}`);
      console.log(`   New players to create: ${stats.new_players}`);
      console.log(`   Players to remove (set to no_club): ${stats.removed_players}`);
      console.log(`   Unmatched website players: ${stats.unmatched_website_players}`);
      console.log(`   Total actions generated: ${stats.actions_total}`);

      if (result.saveResult) {
        console.log(`\n💾 Actions saved to: ${result.saveResult.filePath}`);
        console.log(`   Updates: ${result.saveResult.updates}`);
        console.log(`   Creates: ${result.saveResult.creates}`);
        console.log(`   Removes: ${result.saveResult.removes}`);
      }

    } else if (options.mode === 'scrape-only') {
      // Web scraping only
      console.log('\n🕷️  Web scraping mode - skipping API fetch');
      await syncService.scrapeWebData({
        maxClubs: options.scrapingMaxClubs,
        skipClubs: options.scrapingSkipClubs,
        saveIncremental: options.saveIncremental,
        outputFile: options.scrapingOutputFile
      });

      // Display summary
      console.log('\n📊 Scraping Summary:');
      const scrapingSummary = syncService.getScrapedPlayersSummary();
      console.log(`   Total players: ${scrapingSummary.total}`);
      console.log(`   Players with pictures: ${scrapingSummary.withPictures}`);
      console.log(`   Players without pictures: ${scrapingSummary.withoutPictures}`);
      console.log(`   Players with age: ${scrapingSummary.withAge}`);
      console.log(`   Players without age: ${scrapingSummary.withoutAge}`);
      console.log(`   Total clubs: ${scrapingSummary.clubs}`);
      if (scrapingSummary.ageRange && scrapingSummary.ageRange.min && scrapingSummary.ageRange.max) {
        console.log(`   Age range: ${scrapingSummary.ageRange.min} - ${scrapingSummary.ageRange.max}`);
      }

    } else if (options.mode === 'update-website') {
      // Update website with player actions
      console.log('\n🔄 Updating website with player actions...');
      const result = await syncService.updateWebsiteWithPlayerActions(options.matchingOutputFile);
      console.log(`\n🎉 Website updated finished!`);
      console.log(`   Total actions: ${result.totalActions}`);
      console.log(`   Total updated: ${result.totalUpdated}`);
      console.log(`   Total skipped or failed: ${result.skippedOrFailed}`);
    } else {
      // API only (legacy mode)
      console.log('\n📥 API-only mode - fetching from your website...');
      const players = await syncService.fetchAllPlayers({
        startPage: options.startPage,
        maxPages: options.maxPages,
        batchSize: options.batchSize,
        saveIncremental: options.saveIncremental
      });

      // Save to file (if not already saved incrementally)
      if (!options.saveIncremental) {
        console.log('\n💾 Saving players to file...');
        const result = await syncService.savePlayersToFile(options.outputFile);
        
        if (result) {
          console.log(`✅ Players saved successfully!`);
          console.log(`   File: ${result.playersFile}`);
          console.log(`   Total players: ${result.totalPlayers}`);
        }
      }

      // Display summary
      console.log('\n📊 API Summary:');
      const summary = syncService.getPlayersSummary();
      console.log(`   Total players: ${summary.total}`);
      console.log(`   Players with pictures: ${summary.withPictures}`);
      console.log(`   Players without pictures: ${summary.withoutPictures}`);
      console.log(`   Total clubs: ${summary.clubs}`);
      if (summary.ageRange && summary.ageRange.min && summary.ageRange.max) {
        console.log(`   Age range: ${summary.ageRange.min} - ${summary.ageRange.max}`);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total execution time: ${duration} seconds`);
    console.log('🎉 Sync completed successfully!');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

function parseArgs(args) {
  const options = {
    // API options
    startPage: 1,
    maxPages: null,
    batchSize: config.pagination.defaultPerPage,
    saveIncremental: false,
    outputFile: config.output.playersFile,
    
    // Web scraping options
    enableWebScraping: true,
    scrapingMaxClubs: null,
    scrapingSkipClubs: [],
    scrapingOutputFile: 'scraped_players.jsonl',
    scrapingConcurrency: config.scraping.scrapingConcurrency,
    
    // Mode options
    mode: 'api-only',
    
    // Sync options
    updateConcurrency: config.sync.updateConcurrency,
    
    // Matching options
    websitePlayersFile: config.output.playersFile,
    scrapedPlayersFile: 'scraped_players.jsonl',
    matchingOutputFile: 'player_actions.jsonl',
    skipLoadWebsite: false,
    skipLoadScraped: false,
    
    // Fuzzy matching configuration (from config file)
    minMatchScore: config.playerMatching.minMatchScore,
    nameThreshold: config.playerMatching.nameThreshold, 
    nicknameThreshold: config.playerMatching.nicknameThreshold,
    nameWeight: config.playerMatching.weights.name,
    nicknameWeight: config.playerMatching.weights.nickname,
    yearWeight: config.playerMatching.weights.yearOfBirth,
    maxYearDifference: config.playerMatching.maxYearDifference,
    yearDiffPenalty: config.playerMatching.yearDiffPenalty,
    minNameScore: config.playerMatching.minNameScore,
    debugMatching: config.playerMatching.debug
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--start-page':
        options.startPage = parseInt(args[++i]) || 1;
        break;
      case '--max-pages':
        options.maxPages = parseInt(args[++i]) || null;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || config.pagination.defaultPerPage;
        break;
      case '--incremental':
        options.saveIncremental = true;
        break;
      case '--output':
        options.outputFile = args[++i] || config.output.playersFile;
        break;
      case '--mode':
        const mode = args[++i];
        if (['api-only', 'scrape-only', 'full', 'match', 'update-website'].includes(mode)) {
          options.mode = mode;
        } else {
          console.warn(`Invalid mode: ${mode}. Using default: api-only`);
        }
        break;
      case '--scraping-max-clubs':
        options.scrapingMaxClubs = parseInt(args[++i]) || null;
        break;
      case '--scraping-output':
        options.scrapingOutputFile = args[++i] || 'scraped_players.jsonl';
        break;
      case '--skip-clubs':
        const clubsToSkip = args[++i];
        if (clubsToSkip) {
          options.scrapingSkipClubs = clubsToSkip.split(',').map(c => c.trim());
        }
        break;
      case '--no-web-scraping':
        options.enableWebScraping = false;
        break;
      case '--website-players-file':
        options.websitePlayersFile = args[++i] || config.output.playersFile;
        break;
      case '--scraped-players-file':
        options.scrapedPlayersFile = args[++i] || 'scraped_players.jsonl';
        break;
      case '--matching-output':
        options.matchingOutputFile = args[++i] || 'player_actions.jsonl';
        break;
      case '--skip-load-website':
        options.skipLoadWebsite = true;
        break;
      case '--skip-load-scraped':
        options.skipLoadScraped = true;
        break;
      case '--min-match-score':
        options.minMatchScore = parseFloat(args[++i]) || config.playerMatching.minMatchScore;
        break;
      case '--name-threshold':
        options.nameThreshold = parseFloat(args[++i]) || config.playerMatching.nameThreshold;
        break;
      case '--nickname-threshold':
        options.nicknameThreshold = parseFloat(args[++i]) || config.playerMatching.nicknameThreshold;
        break;
      case '--name-weight':
        options.nameWeight = parseFloat(args[++i]) || config.playerMatching.weights.name;
        break;
      case '--nickname-weight':
        options.nicknameWeight = parseFloat(args[++i]) || config.playerMatching.weights.nickname;
        break;
      case '--year-weight':
        options.yearWeight = parseFloat(args[++i]) || config.playerMatching.weights.yearOfBirth;
        break;
      case '--max-year-diff':
        const yearDiffArg = args[++i];
        options.maxYearDifference = yearDiffArg !== undefined ? parseInt(yearDiffArg) : config.playerMatching.maxYearDifference;
        break;
      case '--year-penalty':
        options.yearDiffPenalty = parseFloat(args[++i]) || config.playerMatching.yearDiffPenalty;
        break;
      case '--min-name-score':
        options.minNameScore = parseFloat(args[++i]) || config.playerMatching.minNameScore;
        break;
      case '--debug-matching':
        options.debugMatching = true;
        break;
      case '--update-concurrency':
        options.updateConcurrency = parseInt(args[++i]) || config.sync.updateConcurrency;
        break;
      case '--scraping-concurrency':
        options.scrapingConcurrency = parseInt(args[++i]) || config.scraping.scrapingConcurrency;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🎯 AFPB Player Sync Tool - Help

Usage: node src/sync-players.js [options]

MODES:
  --mode <mode>           Sync mode: 'api-only', 'scrape-only', 'full', or 'match' (default: api-only)
                         - api-only: Only fetch from your API
                         - scrape-only: Only scrape AFPB website  
                         - full: Both API and web scraping
                         - match: Compare and generate actions for updates/creates

API OPTIONS:
  --start-page <number>    Start from specific page (default: 1)
  --max-pages <number>     Maximum pages to fetch (default: all)
  --batch-size <number>    Players per page (default: ${config.pagination.defaultPerPage})
  --incremental           Save data incrementally as it's fetched
  --output <filename>     API output filename (default: ${config.output.playersFile})

WEB SCRAPING OPTIONS:
  --scraping-max-clubs <number>  Maximum clubs to scrape (default: all)
  --scraping-output <filename>   Scraping output filename (default: scraped_players.jsonl)
  --scraping-concurrency <2-5>   Number of concurrent club scraping requests (default: ${config.scraping.scrapingConcurrency})
  --skip-clubs <list>           Comma-separated list of club names to skip
  --no-web-scraping            Disable web scraping in full mode

MATCHING OPTIONS (for --mode match):
  --website-players-file <file>  Website players file (default: ${config.output.playersFile})
  --scraped-players-file <file>  Scraped players file (default: scraped_players.jsonl)
  --matching-output <file>       Output file for actions (default: player_actions.jsonl)
  --skip-load-website           Don't load website data (use already loaded)
  --skip-load-scraped           Don't load scraped data (use already loaded)

FUZZY MATCHING TUNING:
  --min-match-score <0-1>       Minimum overall score to consider match (default: ${config.playerMatching.minMatchScore})
  --name-threshold <0-1>        Minimum name similarity. The real score is kept, or returned as 0 when below this (default: ${config.playerMatching.nameThreshold})
  --nickname-threshold <0-1>    Nickname fuzzy matching threshold (default: ${config.playerMatching.nicknameThreshold})
  --name-weight <0-1>           Name importance weight (default: ${config.playerMatching.weights.name})
  --nickname-weight <0-1>       Nickname importance weight (default: ${config.playerMatching.weights.nickname})  
  --year-weight <0-1>           Year of birth importance weight (default: ${config.playerMatching.weights.yearOfBirth})
  --max-year-diff <number>      Maximum year difference allowed (default: ${config.playerMatching.maxYearDifference})
  --year-penalty <0-1>          Penalty per year difference (default: ${config.playerMatching.yearDiffPenalty})
  --min-name-score <0-1>        Minimum name score required (default: ${config.playerMatching.minNameScore})
  --debug-matching              Enable detailed matching debug output

SYNC OPTIONS:
  --update-concurrency <2-5>    Number of concurrent requests when updating players (default: ${config.sync.updateConcurrency})

GENERAL OPTIONS:
  --help                  Show this help message

Examples:
  # API only (default)
  node src/sync-players.js
  node src/sync-players.js --max-pages 5

  # Web scraping only
  node src/sync-players.js --mode scrape-only
  node src/sync-players.js --mode scrape-only --scraping-max-clubs 3
  node src/sync-players.js --mode scrape-only --scraping-concurrency 5

  # Full sync (API + Web scraping)
  node src/sync-players.js --mode full
  node src/sync-players.js --mode full --max-pages 5 --scraping-max-clubs 3
  node src/sync-players.js --mode full --scraping-concurrency 4

  # Player matching (generate update/create actions)
  node src/sync-players.js --mode match
  node src/sync-players.js --mode match --matching-output custom_actions.jsonl

  # Update website with player actions
  node src/sync-players.js --mode update-website
  node src/sync-players.js --mode update-website --update-concurrency 5

  # Fuzzy matching tuning (override defaults from config)
  node src/sync-players.js --mode match --debug-matching
  node src/sync-players.js --mode match --min-match-score 0.3 --name-threshold 0.4
  node src/sync-players.js --mode match --max-year-diff 1 --name-weight 0.9

  # Advanced options
  node src/sync-players.js --mode full --incremental --skip-clubs "FOLGA,Test Club"
  node src/sync-players.js --mode scrape-only --scraping-output test_scrape.jsonl
  node src/sync-players.js --mode match --website-players-file custom_players.jsonl

Environment Variables:
  API_BASE_URL           API base URL (default: http://localhost:8000/api)
  API_TOKEN             API authorization token
  OUTPUT_DIR            Output directory (default: ./data)
  DEFAULT_PER_PAGE      Default batch size (default: 100)
  UPDATE_CONCURRENCY    Concurrent requests for updates (default: 3)
  SCRAPING_CONCURRENCY  Concurrent club scraping requests (default: 3)
  CLUBS_LIST_URL        AFPB clubs list URL (default: https://afpbarcelos.pt/clubes)
`);
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT. Gracefully shutting down...');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs }; 
