const ApiClient = require('../utils/apiClient');
const FileUtils = require('../utils/fileUtils');
const WebScrapingService = require('./webScrapingService');
const PlayerMatchingService = require('./playerMatchingService');
const config = require('../config');

class PlayerSyncService {
  constructor(options = {}) {
    this.apiClient = new ApiClient();
    this.webScrapingService = new WebScrapingService({
      scrapingConcurrency: options.scrapingConcurrency
    });
    this.playerMatchingService = new PlayerMatchingService(options.matching || {});
    this.allPlayers = [];
    this.scrapedPlayers = [];
    
    // Configurable concurrency level for player updates (2-5 recommended)
    this.UPDATE_CONCURRENCY = options.updateConcurrency || 3;
  }

  async fetchAllPlayers(options = {}) {
    const {
      startPage = 1,
      maxPages = null,
      batchSize = config.pagination.defaultPerPage,
      saveIncremental = false
    } = options;

    console.log('🚀 Starting player data fetch...');
    console.log(`Configuration: startPage=${startPage}, batchSize=${batchSize}`);

    try {
      // Clear previous data if not doing incremental save
      if (!saveIncremental) {
        this.allPlayers = [];
      }

      // First request to get pagination info
      const firstResponse = await this.apiClient.fetchPlayers(startPage, batchSize);
      
      if (!firstResponse.success) {
        throw new Error('API returned unsuccessful response');
      }

      const { data: firstBatch, pagination } = firstResponse;
      console.log(`📊 Total players available: ${pagination.total}`);
      console.log(`📄 Total pages: ${pagination.last_page}`);
      console.log(`📦 Players per page: ${pagination.per_page}`);

      // Add first batch
      this.allPlayers.push(...firstBatch);
      console.log(`✅ Fetched page ${pagination.current_page} (${firstBatch.length} players)`);

      // If saving incrementally, save first batch
      if (saveIncremental) {
        await this.savePlayersIncremental(firstBatch);
      }

      // Determine how many pages to fetch
      const totalPages = maxPages ? Math.min(pagination.last_page, maxPages) : pagination.last_page;
      const startPageNum = startPage + 1; // Next page after first

      // Fetch remaining pages
      if (startPageNum <= totalPages) {
        console.log(`📥 Fetching remaining pages (${startPageNum} to ${totalPages})...`);
        
        for (let page = startPageNum; page <= totalPages; page++) {
          try {
            const response = await this.apiClient.fetchPlayers(page, batchSize);
            
            if (response.success && response.data) {
              this.allPlayers.push(...response.data);
              console.log(`✅ Fetched page ${page} (${response.data.length} players)`);
              
              // If saving incrementally, save this batch
              if (saveIncremental) {
                await this.savePlayersIncremental(response.data);
              }
            } else {
              console.warn(`⚠️  Page ${page} returned no data or unsuccessful response`);
            }

            // Add delay between requests to be respectful
            if (page < totalPages) {
              await this.sleep(config.scraping.requestDelay);
            }

          } catch (error) {
            console.error(`❌ Failed to fetch page ${page}:`, error.message);
            // Continue with next page instead of failing completely
          }
        }
      }

      console.log(`🎉 Fetch complete! Total players collected: ${this.allPlayers.length}`);
      return this.allPlayers;

    } catch (error) {
      console.error('❌ Failed to fetch players:', error.message);
      throw error;
    }
  }

  async savePlayersToFile(filename = config.output.playersFile) {
    if (this.allPlayers.length === 0) {
      console.warn('⚠️  No players data to save');
      return null;
    }

    try {
      // Add metadata
      const dataWithMetadata = {
        metadata: {
          fetchedAt: new Date().toISOString(),
          totalPlayers: this.allPlayers.length,
          version: '1.0.0'
        },
        players: this.allPlayers
      };

      // Save as JSON lines (one player per line)
      const filePath = await FileUtils.writeJsonLines(this.allPlayers, filename);
      
      // Also save metadata separately
      const metadataFile = filename.replace('.jsonl', '_metadata.json');
      await FileUtils.writeJsonLines([dataWithMetadata.metadata], metadataFile);

      return {
        playersFile: filePath,
        totalPlayers: this.allPlayers.length,
        metadata: dataWithMetadata.metadata
      };

    } catch (error) {
      console.error('❌ Failed to save players to file:', error.message);
      throw error;
    }
  }

  async savePlayersIncremental(players, filename = config.output.playersFile) {
    try {
      await FileUtils.appendJsonLines(players, filename);
    } catch (error) {
      console.error('❌ Failed to save players incrementally:', error.message);
      throw error;
    }
  }

  async loadPlayersFromFile(filename = config.output.playersFile) {
    try {
      const players = await FileUtils.readJsonLines(filename);
      this.allPlayers = players;
      console.log(`📁 Loaded ${players.length} players from file`);
      return players;
    } catch (error) {
      console.error('❌ Failed to load players from file:', error.message);
      throw error;
    }
  }

  getPlayersSummary() {
    if (this.allPlayers.length === 0) {
      return { total: 0, summary: 'No players loaded' };
    }

    const summary = {
      total: this.allPlayers.length,
      withPictures: this.allPlayers.filter(p => p.picture && p.picture.trim()).length,
      withoutPictures: this.allPlayers.filter(p => !p.picture || !p.picture.trim()).length,
      clubs: [...new Set(this.allPlayers.map(p => p.current_club_name).filter(Boolean))].length,
      ageRange: {
        min: Math.min(...this.allPlayers.map(p => p.age).filter(age => age > 0)),
        max: Math.max(...this.allPlayers.map(p => p.age).filter(age => age > 0))
      }
    };

    return summary;
  }

  async performFullSync(options = {}) {
    const {
      // API options
      apiStartPage = 1,
      apiMaxPages = null,
      apiBatchSize = config.pagination.defaultPerPage,
      apiSaveIncremental = false,
      apiOutputFile = config.output.playersFile,
      
      // Web scraping options
      enableWebScraping = true,
      scrapingMaxClubs = null,
      scrapingSkipClubs = [],
      scrapingSaveIncremental = false,
      scrapingOutputFile = 'scraped_players.jsonl'
    } = options;

    const startTime = Date.now();
    console.log('🚀 Starting FULL SYNC process...');
    console.log('=====================================');

    try {
      // Phase 1: Fetch data from your API
      console.log('\n📡 PHASE 1: Fetching data from your API...');
      await this.fetchAllPlayers({
        startPage: apiStartPage,
        maxPages: apiMaxPages,
        batchSize: apiBatchSize,
        saveIncremental: apiSaveIncremental
      });

      // Save API data if not already saved incrementally
      if (!apiSaveIncremental && this.allPlayers.length > 0) {
        console.log('\n💾 Saving API data to file...');
        await this.savePlayersToFile(apiOutputFile);
      }

      // Phase 2: Web scraping (if enabled)
      if (enableWebScraping) {
        console.log('\n🕷️  PHASE 2: Web scraping AFPB website...');
        this.scrapedPlayers = await this.webScrapingService.scrapeAllPlayers({
          maxClubs: scrapingMaxClubs,
          skipClubs: scrapingSkipClubs,
          saveIncremental: scrapingSaveIncremental,
          outputFile: scrapingOutputFile
        });

        // Save scraped data if not already saved incrementally
        if (!scrapingSaveIncremental && this.scrapedPlayers.length > 0) {
          console.log('\n💾 Saving scraped data to file...');
          await this.webScrapingService.savePlayersToFile(scrapingOutputFile);
        }
      } else {
        console.log('\n⚠️  Web scraping disabled, skipping Phase 2');
      }

      // Phase 3: Player matching
      console.log('\n🎯 PHASE 3: Player matching');
      const matchResult = await this.performPlayerMatching({
        websitePlayersFile: options.websitePlayersFile,
        scrapedPlayersFile: options.scrapedPlayersFile,
        outputFile: options.matchingOutputFile,
        loadWebsiteData: !options.skipLoadWebsite,
        loadScrapedData: !options.skipLoadScraped
      });

      // Display summary
      console.log('\n📊 Matching Summary:');
      const stats = matchResult.stats;
      console.log(`   Total matches found: ${stats.total_matches}`);
      console.log(`   Players needing club updates: ${stats.club_changes}`);
      console.log(`   New players to create: ${stats.new_players}`);
      console.log(`   Unmatched website players: ${stats.unmatched_website_players}`);
      console.log(`   Total actions generated: ${stats.actions_total}`);

      if (matchResult.saveResult) {
        console.log(`\n💾 Actions saved to: ${matchResult.saveResult.filePath}`);
        console.log(`   Updates: ${matchResult.saveResult.updates}`);
        console.log(`   Creates: ${matchResult.saveResult.creates}`);
      }

      // Phase 4: Use player_actions.jsonl to update the website
      console.log('\n🔄 PHASE 4: Updating website with player actions...');
      const updateResult = await this.updateWebsiteWithPlayerActions('player_actions.jsonl');
      console.log(`\n🎉 Website updated finished!`);
      console.log(`   Total actions: ${updateResult.totalActions}`);
      console.log(`   Total updated: ${updateResult.totalUpdated}`);
      console.log(`   Total skipped or failed: ${updateResult.skippedOrFailed}`);

      // Phase 5: Summary and completion
      console.log('\n📊 SYNC COMPLETE - Final Summary:');
      console.log('==================================');
      
      const apiSummary = this.getPlayersSummary();
      console.log(`\n📡 API Data (Your Website):`);
      console.log(`   Total players: ${apiSummary.total}`);
      console.log(`   Players with pictures: ${apiSummary.withPictures}`);
      console.log(`   Players without pictures: ${apiSummary.withoutPictures}`);
      console.log(`   Total clubs: ${apiSummary.clubs}`);
      if (apiSummary.ageRange && apiSummary.ageRange.min && apiSummary.ageRange.max) {
        console.log(`   Age range: ${apiSummary.ageRange.min} - ${apiSummary.ageRange.max}`);
      }

      if (enableWebScraping) {
        const scrapingSummary = this.webScrapingService.getScrapingSummary();
        console.log(`\n🕷️  Scraped Data (AFPB Website):`);
        console.log(`   Total players: ${scrapingSummary.total}`);
        console.log(`   Players with pictures: ${scrapingSummary.withPictures}`);
        console.log(`   Players without pictures: ${scrapingSummary.withoutPictures}`);
        console.log(`   Players with age: ${scrapingSummary.withAge}`);
        console.log(`   Players without age: ${scrapingSummary.withoutAge}`);
        console.log(`   Total clubs: ${scrapingSummary.clubs}`);
        if (scrapingSummary.ageRange && scrapingSummary.ageRange.min && scrapingSummary.ageRange.max) {
          console.log(`   Age range: ${scrapingSummary.ageRange.min} - ${scrapingSummary.ageRange.max}`);
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Total sync time: ${duration} seconds`);
      console.log('🎉 Full sync completed successfully!');

      return {
        apiPlayers: this.allPlayers,
        scrapedPlayers: this.scrapedPlayers,
        apiSummary: apiSummary,
        scrapingSummary: enableWebScraping ? this.webScrapingService.getScrapingSummary() : null,
        duration: duration
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error.message);
      throw error;
    }
  }

  async scrapeWebData(options = {}) {
    const {
      maxClubs = null,
      skipClubs = [],
      saveIncremental = false,
      outputFile = 'scraped_players.jsonl'
    } = options;

    console.log('🕷️  Starting web scraping only...');
    
    try {
      this.scrapedPlayers = await this.webScrapingService.scrapeAllPlayers({
        maxClubs,
        skipClubs,
        saveIncremental,
        outputFile
      });

      if (!saveIncremental && this.scrapedPlayers.length > 0) {
        await this.webScrapingService.savePlayersToFile(outputFile);
      }

      return this.scrapedPlayers;
    } catch (error) {
      console.error('❌ Web scraping failed:', error.message);
      throw error;
    }
  }

  getScrapedPlayersSummary() {
    return this.webScrapingService.getScrapingSummary();
  }

  async loadScrapedPlayersFromFile(filename = 'scraped_players.jsonl') {
    try {
      const players = await FileUtils.readJsonLines(filename);
      this.scrapedPlayers = players;
      console.log(`📁 Loaded ${players.length} scraped players from file`);
      return players;
    } catch (error) {
      console.error('❌ Failed to load scraped players from file:', error.message);
      throw error;
    }
  }

  async performPlayerMatching(options = {}) {
    const {
      websitePlayersFile = config.output.playersFile,
      scrapedPlayersFile = 'scraped_players.jsonl',
      outputFile = 'player_actions.jsonl',
      loadWebsiteData = true,
      loadScrapedData = true
    } = options;

    console.log('🎯 Starting player matching process...');
    console.log('=====================================');

    try {
      // Load website players if needed
      if (loadWebsiteData) {
        console.log('\n📡 Loading website players...');
        await this.loadPlayersFromFile(websitePlayersFile);
      }

      // Load scraped players if needed
      if (loadScrapedData) {
        console.log('\n🕷️  Loading scraped players...');
        await this.loadScrapedPlayersFromFile(scrapedPlayersFile);
      }

      // Validate we have data
      if (this.allPlayers.length === 0) {
        throw new Error('No website players loaded. Please run API fetch first or specify correct file.');
      }

      if (this.scrapedPlayers.length === 0) {
        throw new Error('No scraped players loaded. Please run web scraping first or specify correct file.');
      }

      console.log(`\n🔍 Data loaded successfully:`);
      console.log(`   Website players: ${this.allPlayers.length}`);
      console.log(`   AFPB scraped players: ${this.scrapedPlayers.length}`);

      // Perform matching
      console.log('\n🎯 Processing player matching...');
      const matchResults = await this.playerMatchingService.processPlayerMatching(
        this.allPlayers,
        this.scrapedPlayers,
        this.webScrapingService.getSuccessfullyScrapedClubs()
      );

      // Save results to file
      console.log('\n💾 Saving matching results...');
      const saveResult = await this.playerMatchingService.saveMatchingResults(outputFile);

      // Print statistics
      this.playerMatchingService.printMatchingStats();

      return {
        matchResults,
        saveResult,
        stats: this.playerMatchingService.getMatchingStats()
      };

    } catch (error) {
      console.error('❌ Player matching failed:', error.message);
      throw error;
    }
  }

  async updateWebsiteWithPlayerActions(playerActionsFile) {
    let totalUpdated = 0;
    let skippedOrFailed = 0;
    const playerActions = await FileUtils.readJsonLines(playerActionsFile);
    let totalActions = playerActions.length;
    
    if (totalActions === 0) {
      console.log('🔄 No player actions to update website with');
      return {
        totalActions: 0,
        totalUpdated: 0,
        skippedOrFailed: 0,
      };
    }

    console.log(`🔄 Processing ${totalActions} player actions with concurrency level: ${this.UPDATE_CONCURRENCY}`);

    // Process actions in concurrent batches
    for (let i = 0; i < playerActions.length; i += this.UPDATE_CONCURRENCY) {
      const batch = playerActions.slice(i, i + this.UPDATE_CONCURRENCY);
      const batchPromises = batch.map(action => this.updatePlayer(action));
      
      // Use Promise.allSettled to handle failures gracefully
      const results = await Promise.allSettled(batchPromises);
      
      // Count successes and failures
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value === true) {
          totalUpdated++;
        } else {
          skippedOrFailed++;
          if (result.status === 'rejected') {
            console.error(`❌ Failed to update player: ${batch[idx].name}`, result.reason);
          }
        }
      });

      // Progress indicator
      const processed = Math.min(i + this.UPDATE_CONCURRENCY, totalActions);
      console.log(`   Progress: ${processed}/${totalActions} (${Math.round(processed / totalActions * 100)}%)`);
    }

    return {
      totalActions,
      totalUpdated,
      skippedOrFailed
    }
  }

  async updatePlayer(row) {
    await this.sleep(250);

    let body = {
      name: row.name,
      nickname: row.nickname,
      picture_url: row.picture_url,
      club_name: row.club_name,
      team: row.team || null,
    }

    if (row.action === 'update') {
      body.player_id = row.website_player_id;
      let matchedNickname = row.match_details?.nicknameMatch == 1 ? 'alcunha igual' : 'alcunha diferente';
      let matchedYearOfBirth = row.match_details?.yearOfBirthMatch ? 'ano de nascimento igual' : `ano de nascimento diferente (${row.match_details?.yearDifference} de diferença)`;
      body.obs = `Match ${Math.round(row.match_score * 100)}% certeza, ${matchedNickname}, ${matchedYearOfBirth}`;
    }

    if (row.action === 'remove') {
      body.player_id = row.website_player_id;
      body.obs = `Ultima vez visto em ${row.previous_club}, não foi agora encontrado`;
    }

    if (row.action === 'create') {
      // I don't have any way of knowing the real player birth date, but I have the age,
      // so I'll just use the age to calculate the birth date year, make the best estimation I can
      // because just getting the year right is better than nothing, it helps in future matches
      let birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - row.age);
      body.birth_date = birthDate.toISOString().split('T')[0];
    }

    try {
      await this.apiClient.createUpdateRequest(body);
      return true;
    } catch (error) {
      console.error('❌ Failed to update player:', error.message);
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PlayerSyncService;
