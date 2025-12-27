const { PlayerSyncService, FileUtils } = require('../src');

async function basicExample() {
  console.log('🎯 Basic Usage Example');
  console.log('======================\n');

  try {
    // Initialize the sync service
    const syncService = new PlayerSyncService();

    // Example 1: Fetch just a few pages for testing
    console.log('📥 Fetching first 3 pages...');
    const players = await syncService.fetchAllPlayers({
      maxPages: 3,
      batchSize: 50
    });

    console.log(`✅ Fetched ${players.length} players\n`);

    // Example 2: Save to a custom file
    console.log('💾 Saving to custom file...');
    await syncService.savePlayersToFile('example_players.jsonl');

    // Example 3: Get summary statistics
    console.log('📊 Player Statistics:');
    const summary = syncService.getPlayersSummary();
    console.log(`   Total players: ${summary.total}`);
    console.log(`   Players with pictures: ${summary.withPictures}`);
    console.log(`   Players without pictures: ${summary.withoutPictures}`);
    console.log(`   Total clubs: ${summary.clubs}`);
    
    if (summary.ageRange && !isNaN(summary.ageRange.min)) {
      console.log(`   Age range: ${summary.ageRange.min} - ${summary.ageRange.max}`);
    }

    // Example 4: Read data back from file
    console.log('\n📁 Reading data back from file...');
    const loadedPlayers = await FileUtils.readJsonLines('example_players.jsonl');
    console.log(`✅ Loaded ${loadedPlayers.length} players from file`);

    // Example 5: Show some sample player data
    console.log('\n👥 Sample Players:');
    loadedPlayers.slice(0, 3).forEach((player, index) => {
      console.log(`   ${index + 1}. ${player.name} (${player.age} years old) - ${player.current_club_name}`);
      if (player.picture) {
        console.log(`      Picture: ${player.picture}`);
      }
    });

    console.log('\n🎉 Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Make sure your API server is running on http://localhost:8000');
    }
  }
}

// Run the example
if (require.main === module) {
  basicExample();
}

module.exports = { basicExample }; 