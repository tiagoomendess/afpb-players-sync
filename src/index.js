const PlayerSyncService = require('./services/playerSyncService');
const WebScrapingService = require('./services/webScrapingService');
const ApiClient = require('./utils/apiClient');
const FileUtils = require('./utils/fileUtils');
const config = require('./config');

// Export main classes and utilities
module.exports = {
  PlayerSyncService,
  WebScrapingService,
  ApiClient,
  FileUtils,
  config
};

// If called directly, show usage information
if (require.main === module) {
  console.log('🎯 AFPB Player Sync Library');
  console.log('==========================');
  console.log('');
  console.log('This is the main library file. To sync players, use one of these commands:');
  console.log('');
  console.log('  npm run sync                    # Sync all players');
  console.log('  node src/sync-players.js        # Direct command');
  console.log('  node src/sync-players.js --help # Show help');
  console.log('');
  console.log('To use programmatically:');
  console.log('');
  console.log('  const { PlayerSyncService } = require("./src");');
  console.log('  const syncService = new PlayerSyncService();');
  console.log('  const players = await syncService.fetchAllPlayers();');
  console.log('');
}
