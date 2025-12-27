const { PlayerSyncService, WebScrapingService } = require('../src');

async function webScrapingExample() {
  console.log('🕷️  Web Scraping Example');
  console.log('=========================\n');

  try {
    // Example 1: Direct web scraping service usage
    console.log('📋 Example 1: Direct web scraping service...');
    const webScraper = new WebScrapingService();
    
    // Test with just a few clubs
    const scrapedPlayers = await webScraper.scrapeAllPlayers({
      maxClubs: 3, // Only scrape first 3 clubs for testing
      saveIncremental: false,
      outputFile: 'example_scraped_players.jsonl'
    });

    console.log(`✅ Scraped ${scrapedPlayers.length} players from ${webScraper.stats.clubsProcessed} clubs\n`);

    // Example 2: Using PlayerSyncService for full sync
    console.log('🔄 Example 2: Full sync (API + Web scraping)...');
    const syncService = new PlayerSyncService();
    
    const fullSyncResult = await syncService.performFullSync({
      // API options - limit for testing
      apiMaxPages: 2,
      apiBatchSize: 50,
      apiOutputFile: 'example_api_players.jsonl',
      
      // Web scraping options - limit for testing
      enableWebScraping: true,
      scrapingMaxClubs: 2,
      scrapingOutputFile: 'example_full_sync_scraped.jsonl'
    });

    console.log('\n📊 Full Sync Results:');
    console.log(`   API Players: ${fullSyncResult.apiPlayers.length}`);
    console.log(`   Scraped Players: ${fullSyncResult.scrapedPlayers.length}`);
    console.log(`   Total Duration: ${fullSyncResult.duration} seconds`);

    // Example 3: Show scraped data format
    console.log('\n👥 Sample Scraped Players:');
    if (scrapedPlayers.length > 0) {
      scrapedPlayers.slice(0, 3).forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.name} (${player.club_name})`);
        if (player.age) {
          console.log(`      Age: ${player.age}`);
        }
        if (player.picture_url) {
          console.log(`      Picture: ${player.picture_url}`);
        }
        console.log(`      Scraped at: ${player.scraped_at}`);
      });
    }

    console.log('\n🎉 Web scraping example completed!');

  } catch (error) {
    console.error('❌ Web scraping example failed:', error.message);
    
    // Common issues and solutions
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Tip: Check your internet connection and the target website URL');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Tip: The website might be slow. Try increasing timeout in config');
    } else if (error.message.includes('REPLACE_WITH')) {
      console.log('\n💡 Tip: You need to replace the CSS selectors with actual ones from the website');
      console.log('   Check the WebScrapingService file and update the selectors marked as REPLACE_WITH_*');
    }
  }
}

// Run the example
if (require.main === module) {
  webScrapingExample();
}

module.exports = { webScrapingExample }; 