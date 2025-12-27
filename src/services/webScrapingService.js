const axios = require('axios');
const cheerio = require('cheerio');
const { validateSelectors, getConfigurationInstructions, ...config } = require('../config');
const FileUtils = require('../utils/fileUtils');
const ClubMappingService = require('./clubMappingService');

class WebScrapingService {
  constructor(options = {}) {
    this.httpClient = axios.create({
      timeout: config.api.timeout,
      headers: {
        'User-Agent': config.scraping.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    this.scrapedPlayers = [];
    this.successfullyScrapedClubs = new Map(); // Track clubs that were scraped successfully
    this.stats = {
      clubsTotal: 0,
      clubsProcessed: 0,
      clubsWithErrors: 0,
      playersFound: 0,
      errors: []
    };

    // Initialize club mapping service
    this.clubMappingService = new ClubMappingService();

    // Check if selectors are configured
    this.selectorsValidation = validateSelectors();
    
    // Configurable concurrency level for club scraping (2-5 recommended)
    this.SCRAPING_CONCURRENCY = options.scrapingConcurrency || config.scraping.scrapingConcurrency || 3;
  }

  async scrapeAllPlayers(options = {}) {
    const {
      maxClubs = null,
      skipClubs = [],
      saveIncremental = false,
      outputFile = 'scraped_players.jsonl'
    } = options;

    console.log('🕷️  Starting web scraping process...');
    console.log(`Target: ${config.scraping.clubsListUrl}`);

    // Check if selectors are configured
    if (!this.selectorsValidation.isValid) {
      console.warn('⚠️  CSS selectors not configured properly:');
      this.selectorsValidation.errors.forEach(error => {
        console.warn(`   - ${error}`);
      });
      console.log(getConfigurationInstructions());
      console.log('⚠️  Proceeding anyway, but scraping will likely return no results...\n');
    }

    try {
      // Reset stats and data
      this.scrapedPlayers = [];
      this.resetStats();

      // Step 1: Get list of clubs from the main page
      console.log('\n📋 Fetching clubs list...');
      const clubs = await this.scrapeClubsList();
      
      this.stats.clubsTotal = clubs.length;
      console.log(`✅ Found ${clubs.length} clubs to process`);

      // Filter clubs if needed
      let clubsToProcess = clubs;
      if (skipClubs.length > 0) {
        clubsToProcess = clubs.filter(club => !skipClubs.includes(club.name));
        console.log(`⚠️  Skipping ${clubs.length - clubsToProcess.length} clubs as requested`);
      }

      if (maxClubs) {
        clubsToProcess = clubsToProcess.slice(0, maxClubs);
        console.log(`📏 Limited to first ${maxClubs} clubs for testing`);
      }

      // Step 2: Process clubs in concurrent batches
      console.log(`\n👥 Processing ${clubsToProcess.length} clubs with concurrency level: ${this.SCRAPING_CONCURRENCY}`);
      
      for (let i = 0; i < clubsToProcess.length; i += this.SCRAPING_CONCURRENCY) {
        const batch = clubsToProcess.slice(i, i + this.SCRAPING_CONCURRENCY);
        const batchPromises = batch.map((club, batchIndex) => 
          this.processClub(club, i + batchIndex + 1, clubsToProcess.length, saveIncremental, outputFile)
        );
        
        // Use Promise.allSettled to handle failures gracefully
        await Promise.allSettled(batchPromises);
        
        // Progress indicator
        const processed = Math.min(i + this.SCRAPING_CONCURRENCY, clubsToProcess.length);
        console.log(`\n📊 Progress: ${processed}/${clubsToProcess.length} clubs (${Math.round(processed / clubsToProcess.length * 100)}%)`);
        
        // Add delay between batches to be respectful
        if (i + this.SCRAPING_CONCURRENCY < clubsToProcess.length) {
          await this.sleep(config.scraping.requestDelay);
        }
      }

      console.log('\n🎉 Web scraping completed!');
      this.printStats();
      this.printClubMappingStats();

      return this.scrapedPlayers;

    } catch (error) {
      console.error('❌ Web scraping failed:', error.message);
      throw error;
    }
  }

  /**
   * Process a single club (scrape players and handle results)
   * @param {Object} club - Club object with name and URL
   * @param {number} index - Current club index for logging
   * @param {number} total - Total clubs for logging
   * @param {boolean} saveIncremental - Whether to save incrementally
   * @param {string} outputFile - Output file for incremental save
   */
  async processClub(club, index, total, saveIncremental, outputFile) {
    try {
      console.log(`\n[${index}/${total}] Processing: ${club.name}`);
      
      const clubPlayers = await this.scrapeClubPlayers(club);
      
      // Resolve club name mapping for tracking
      const resolvedClubName = await this.clubMappingService.resolveClubName(club.name);
      
      // Mark club as successfully scraped (even if 0 players - we got the data)
      this.successfullyScrapedClubs.set(resolvedClubName, {
        afpbName: club.name,
        resolvedName: resolvedClubName,
        url: club.url,
        playersCount: clubPlayers.length,
        scrapedAt: new Date().toISOString()
      });
      
      if (clubPlayers.length > 0) {
        // Add club info to each player
        const playersWithClub = clubPlayers.map(player => ({
          ...player,
          club_name_afpb: club.name,
          club_name: resolvedClubName,
          club_url: club.url,
          scraped_at: new Date().toISOString()
        }));

        this.scrapedPlayers.push(...playersWithClub);
        this.stats.playersFound += clubPlayers.length;
        
        console.log(`   ✅ Found ${clubPlayers.length} players`);

        // Save incrementally if requested
        if (saveIncremental) {
          await this.savePlayersIncremental(playersWithClub, outputFile);
        }
      } else {
        console.log(`   ⚠️  No players found (but club was scraped successfully)`);
      }

      this.stats.clubsProcessed++;

    } catch (error) {
      this.stats.clubsWithErrors++;
      this.stats.errors.push({
        club: club.name,
        url: club.url,
        error: error.message
      });

      if (error.response?.status === 404) {
        console.log(`   ⚠️  Club page not found (404) - skipping`);
      } else {
        console.warn(`   ❌ Error processing club: ${error.message}`);
      }
    }
  }

  async scrapeClubsList() {
    try {
      const response = await this.httpClient.get(config.scraping.clubsListUrl);
      const $ = cheerio.load(response.data);
      const clubs = [];
      
      // Use configured selectors
      const clubsListSelector = config.scraping.selectors.clubs.listSelector;
      const clubNameSelector = config.scraping.selectors.clubs.nameSelector;
      const clubUrlSelector = config.scraping.selectors.clubs.urlSelector;

      $(clubsListSelector).each((index, element) => {
        const $club = $(element);
        
        // Extract club name and URL
        const name = $club.find(clubNameSelector).text().trim();
        const relativeUrl = $club.find(clubUrlSelector).attr('href');
        
        if (name && relativeUrl) {
          const fullUrl = this.resolveUrl(relativeUrl, config.scraping.clubsListUrl);
          
          clubs.push({
            name: name,
            url: fullUrl,
            relativeUrl: relativeUrl
          });
        }
      });

      // Filter out invalid clubs (like "FOLGA" which means "BYE")
      const validClubs = clubs.filter(club => 
        club.name && 
        !club.name.toLowerCase().includes('folga') &&
        club.url
      );

      return validClubs;

    } catch (error) {
      console.error('Failed to scrape clubs list:', error.message);
      throw error;
    }
  }

  async scrapeClubPlayers(club) {
    try {
      const response = await this.httpClient.get(club.url);
      const $ = cheerio.load(response.data);

      const players = [];

      // Use configured selectors
      const playersListSelector = config.scraping.selectors.players.listSelector;
      const playerNameSelector = config.scraping.selectors.players.nameSelector;
      const playerPictureSelector = config.scraping.selectors.players.pictureSelector;
      const playerAgeSelector = config.scraping.selectors.players.ageSelector;
      const playerTransferedSelector = config.scraping.selectors.players.transferedSelector;

      $(playersListSelector).each((index, element) => {
        const $player = $(element);

        // Extract player data
        let name = $player.find(playerNameSelector).text().trim();
        const pictureUrl = $player.find(playerPictureSelector).attr('src');
        const ageText = $player.find(playerAgeSelector).text().trim();
        const transfered = $player.find(playerTransferedSelector).text().trim();

        // if transfered is not empty, it means the player has been transfered away fromn this club
        // then we should not add the player to the list
        if (transfered) {
          console.log(`   ⚠️  Player ${name} has been transfered away from this club`);
          return;
        }

        // Process age - extract number from text
        let age = null;
        if (ageText) {
          const ageMatch = ageText.match(/\d+/);
          if (ageMatch) {
            age = parseInt(ageMatch[0]);
          }
        }

        // Process picture URL - make it absolute if needed
        let fullPictureUrl = null;
        if (pictureUrl) {
          fullPictureUrl = this.resolveUrl(pictureUrl, club.url);
        }

        // Clean up whitespace in name - replace multiple spaces with single space
        name = name.replace(/\s+/g, ' ').trim();

        // some names come with a string inside parenthesis, its a nickname, extract it
        let nickname = null;
        const nicknameMatch = name.match(/\(([^)]+)\)/);
        if (nicknameMatch) {
          nickname = nicknameMatch[1];
          name = name.replace(`(${nickname})`, '').trim();
          // Clean up nickname whitespace too
          nickname = nickname.replace(/\s+/g, ' ').trim();
          nickname = nickname.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }

        // normalize name. It should start each word with capital letter then lowercase the rest
        name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

        // calculate year of birth by age and current year
        const currentYear = new Date().getFullYear();
        const yearOfBirth = currentYear - age;

        // generate a unique id for the player names all in lowercase and without spaces plus year of birth
        const uniqueId = `${name.toLowerCase().replace(/\s+/g, '_')}_${yearOfBirth}`;

        // Only add player if we have at least a name
        if (name) {
          players.push({
            name: name,
            nickname: nickname,
            picture_url: fullPictureUrl,
            age: age,
            year_of_birth: yearOfBirth,
            unique_id: uniqueId,
          });
        }
      });

      return players;

    } catch (error) {
      // Re-throw with more context
      throw new Error(`Failed to scrape players from ${club.name}: ${error.message}`);
    }
  }

  async savePlayersToFile(filename = 'scraped_players.jsonl') {
    if (this.scrapedPlayers.length === 0) {
      console.warn('⚠️  No scraped players data to save');
      return null;
    }

    try {
      // Add metadata
      const metadata = {
        scrapedAt: new Date().toISOString(),
        totalPlayers: this.scrapedPlayers.length,
        source: 'afpbarcelos.pt',
        stats: this.stats,
        clubMappings: this.clubMappingService.getCacheStats(),
        version: '1.0.0'
      };

      // Save players as JSON lines
      const filePath = await FileUtils.writeJsonLines(this.scrapedPlayers, filename);
      
      // Save metadata separately
      const metadataFile = filename.replace('.jsonl', '_metadata.json');
      await FileUtils.writeJsonLines([metadata], metadataFile);

      return {
        playersFile: filePath,
        totalPlayers: this.scrapedPlayers.length,
        metadata: metadata
      };

    } catch (error) {
      console.error('❌ Failed to save scraped players to file:', error.message);
      throw error;
    }
  }

  async savePlayersIncremental(players, filename = 'scraped_players.jsonl') {
    try {
      await FileUtils.appendJsonLines(players, filename);
    } catch (error) {
      console.error('❌ Failed to save scraped players incrementally:', error.message);
      throw error;
    }
  }

  getScrapingSummary() {
    if (this.scrapedPlayers.length === 0) {
      return { total: 0, summary: 'No players scraped' };
    }

    const summary = {
      total: this.scrapedPlayers.length,
      withPictures: this.scrapedPlayers.filter(p => p.picture_url && p.picture_url.trim()).length,
      withoutPictures: this.scrapedPlayers.filter(p => !p.picture_url || !p.picture_url.trim()).length,
      withAge: this.scrapedPlayers.filter(p => p.age && p.age > 0).length,
      withoutAge: this.scrapedPlayers.filter(p => !p.age || p.age <= 0).length,
      clubs: [...new Set(this.scrapedPlayers.map(p => p.club_name).filter(Boolean))].length,
      ageRange: this.getAgeRange()
    };

    return summary;
  }

  getAgeRange() {
    const ages = this.scrapedPlayers
      .map(p => p.age)
      .filter(age => age && age > 0);

    if (ages.length === 0) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...ages),
      max: Math.max(...ages)
    };
  }

  printStats() {
    console.log('\n📊 Scraping Statistics:');
    console.log(`   Clubs total: ${this.stats.clubsTotal}`);
    console.log(`   Clubs processed: ${this.stats.clubsProcessed}`);
    console.log(`   Clubs with errors: ${this.stats.clubsWithErrors}`);
    console.log(`   Players found: ${this.stats.playersFound}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.stats.errors.forEach(error => {
        console.log(`   ${error.club}: ${error.error}`);
      });
    }
  }

  printClubMappingStats() {
    const cacheStats = this.clubMappingService.getCacheStats();
    
    console.log('\n🏢 Club Name Mapping Statistics:');
    console.log(`   Total mappings cached: ${cacheStats.size}`);
    
    const mappedClubs = cacheStats.mappings.filter(m => m.is_mapped);
    const unmappedClubs = cacheStats.mappings.filter(m => !m.is_mapped);
    
    console.log(`   Successfully mapped: ${mappedClubs.length}`);
    console.log(`   Not mapped (using original): ${unmappedClubs.length}`);
    
    if (mappedClubs.length > 0) {
      console.log('\n📋 Club Name Mappings:');
      mappedClubs.forEach(mapping => {
        console.log(`   "${mapping.afpb_name}" -> "${mapping.website_name}"`);
      });
    }
    
    if (unmappedClubs.length > 0) {
      console.log('\n⚠️  Clubs not found on your website:');
      unmappedClubs.forEach(mapping => {
        console.log(`   "${mapping.afpb_name}"`);
      });
    }
  }

  resetStats() {
    this.stats = {
      clubsTotal: 0,
      clubsProcessed: 0,
      clubsWithErrors: 0,
      playersFound: 0,
      errors: []
    };
    this.successfullyScrapedClubs.clear();
  }

  resolveUrl(url, baseUrl) {
    if (!url) return null;
    
    // If already absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If starts with //, add protocol
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    // If starts with /, it's relative to domain
    if (url.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    }
    
    // Otherwise, it's relative to current page
    const baseUrlObj = new URL(baseUrl);
    const basePath = baseUrlObj.pathname.endsWith('/') 
      ? baseUrlObj.pathname 
      : baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);
    
    return `${baseUrlObj.protocol}//${baseUrlObj.host}${basePath}${url}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a club was successfully scraped
   * @param {string} clubName - The club name to check (resolved name)
   * @returns {boolean} - True if club was successfully scraped
   */
  wasClubSuccessfullyScraped(clubName) {
    return this.successfullyScrapedClubs.has(clubName);
  }

  /**
   * Get information about successfully scraped clubs
   * @returns {Map} - Map of successfully scraped clubs
   */
  getSuccessfullyScrapedClubs() {
    return this.successfullyScrapedClubs;
  }

  /**
   * Get the club mapping service instance
   * @returns {ClubMappingService} - The club mapping service
   */
  getClubMappingService() {
    return this.clubMappingService;
  }
}

module.exports = WebScrapingService; 