const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class PlayerMatchingService {
  constructor(options = {}) {
    this.matchResults = {
      updates: [],
      creates: [],
      removes: [],
      matches: [],
      unmatched: []
    };
    
    // Configurable matching parameters (defaults from config file)
    this.config = {
      // Overall minimum score to consider a match (0-1)
      minMatchScore: options.minMatchScore !== undefined ? options.minMatchScore : config.playerMatching.minMatchScore,
      
      // Fuzzy string matching thresholds (0-1) - DEPRECATED: kept for compatibility
      nameThreshold: options.nameThreshold !== undefined ? options.nameThreshold : config.playerMatching.nameThreshold,
      nicknameThreshold: options.nicknameThreshold !== undefined ? options.nicknameThreshold : config.playerMatching.nicknameThreshold,
      
      // Score weights (must sum to 1.0)
      weights: {
        name: options.nameWeight !== undefined ? options.nameWeight : config.playerMatching.weights.name,
        nickname: options.nicknameWeight !== undefined ? options.nicknameWeight : config.playerMatching.weights.nickname,
        club: options.clubWeight !== undefined ? options.clubWeight : config.playerMatching.weights.club,
        yearOfBirth: options.yearWeight !== undefined ? options.yearWeight : config.playerMatching.weights.yearOfBirth
      },
      
      // Year of birth matching tolerance
      maxYearDifference: options.maxYearDifference !== undefined ? options.maxYearDifference : config.playerMatching.maxYearDifference,
      yearDiffPenalty: options.yearDiffPenalty !== undefined ? options.yearDiffPenalty : config.playerMatching.yearDiffPenalty,
      
      // Debug mode
      debug: options.debug !== undefined ? options.debug : config.playerMatching.debug
    };
    
    if (this.config.debug) {
      console.log('🔧 PlayerMatchingService Configuration:');
      console.log('   minMatchScore:', this.config.minMatchScore);
      console.log('   nameThreshold:', this.config.nameThreshold, '(deprecated)');
      console.log('   nicknameThreshold:', this.config.nicknameThreshold, '(deprecated)');
      console.log('   weights:', this.config.weights);
      console.log('   maxYearDifference:', this.config.maxYearDifference);
    }
  }

  // Enhanced normalization for Portuguese characters
  normalize(str) {
    return str.trim()
      // Handle uppercase accented characters first
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖØ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .replace(/[Ñ]/g, 'N')
      // Convert to lowercase
      .toLowerCase()
      // Handle lowercase accented characters
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõöø]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9\s]/g, '');
  }

  /**
   * Fuzzy string matching with threshold
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @param {number} threshold - Match threshold (0-1, where 1 is exact match) - NOW UNUSED, kept for compatibility
   * @returns {number} - Match score (0-1)
   */
  fuzzyMatch(str1, str2, threshold = 0.8) {
    if (!str1 || !str2) return 0;
    
    const norm1 = this.normalize(str1);
    const norm2 = this.normalize(str2);

    // Exact match
    if (norm1 === norm2) return 1;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    
    if (maxLength === 0) return 1;
    
    const similarity = 1 - (distance / maxLength);
    // Return actual similarity score instead of threshold-based binary result
    return Math.max(0, similarity);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Enhanced name matching that considers individual name components
   * @param {string} name1 - First name
   * @param {string} name2 - Second name  
   * @param {number} threshold - Similarity threshold - NOW UNUSED, kept for compatibility
   * @returns {number} - Similarity score (0-1)
   */
  enhancedNameMatch(websitename, afpbName, threshold = 0.8) {
    const weights = {
      fuzzy: 0.5,
      firstName: 0.15,
      lastName: 0.15,
      commonNames: 0.2,
    }

    if (!websitename || !afpbName) return 0;

    if (websitename === afpbName) return 1;
    
    // Basic fuzzy match first
    const fuzzyScore = this.fuzzyMatch(websitename, afpbName, 0.0);
    if (fuzzyScore < threshold) return 0;

    const websiteNameArray = websitename.split(' ');
    const afpbNameArray = afpbName.split(' ');

    // First and last names matches
    const firstNameMatch = websiteNameArray[0] === afpbNameArray[0] ? 1 : 0;
    const lastNameMatch = websiteNameArray[websiteNameArray.length - 1] === afpbNameArray[afpbNameArray.length - 1] ? 1 : 0;

    // Count how many common names are between the two arrays
    const commonNamesCount = afpbNameArray.filter(name => websiteNameArray.includes(name)).length;
    const maxNamesCount = Math.max(websiteNameArray.length, afpbNameArray.length);
    const commonNamesScore = commonNamesCount / maxNamesCount;

    // Calculate the score
    const score = (fuzzyScore * weights.fuzzy) + (firstNameMatch * weights.firstName) + (lastNameMatch * weights.lastName) + (commonNamesScore * weights.commonNames);
    
    return score;
  }

  /**
   * Find the best match for a website player in the AFPB players list
   * @param {Object} websitePlayer - Player from website
   * @param {Array} afpbPlayers - Array of AFPB players
   * @returns {Object|null} - Best match or null if no good match found
   */
  findBestMatch(afpbPlayer, websitePlayers) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const websitePlayer of websitePlayers) {
      const score = this.calculateMatchScore(websitePlayer, afpbPlayer);
      
      if (score > bestScore && score >= this.config.minMatchScore) {
        bestScore = score;
        bestMatch = {
          player: afpbPlayer,
          websitePlayer: websitePlayer,
          score: score,
          matchDetails: this.getMatchDetails(websitePlayer, afpbPlayer)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Extract year of birth from birth_date string
   * @param {string} birthDate - Birth date in format "YYYY-MM-DD HH:MM:SS" or similar
   * @returns {number|null} - Year of birth or null if invalid
   */
  extractYearOfBirth(birthDate) {
    if (!birthDate) return null;
    
    try {
      // Handle various date formats
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) {
        // Try extracting year directly from string
        const yearMatch = birthDate.match(/(\d{4})/);
        return yearMatch ? parseInt(yearMatch[1]) : null;
      }
      return date.getFullYear();
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate overall match score between two players
   * @param {Object} websitePlayer - Player from website
   * @param {Object} afpbPlayer - Player from AFPB
   * @returns {number} - Overall match score (0-1)
   */
  calculateMatchScore(websitePlayer, afpbPlayer) {
    const scores = {
      name: 0,
      club: 0,
      nickname: 0,
      yearOfBirth: 0
    };

    // If same club, add 1 point
    if (websitePlayer.current_club_name && afpbPlayer.club_name) {
      scores.club = websitePlayer.current_club_name === afpbPlayer.club_name ? 1 : 0;
    }
    
    // normalize names to lowercase and no latin characters
    const websiteName = this.normalize(websitePlayer.name);
    const afpbName = this.normalize(afpbPlayer.name);

    // Name matching - get actual similarity score (not thresholded)
    scores.name = this.enhancedNameMatch(websiteName, afpbName, this.config.nameThreshold);
    
    // Nickname matching (optional but helpful)
    if (websitePlayer.nickname && afpbPlayer.nickname) {
      scores.nickname = this.fuzzyMatch(websitePlayer.nickname, afpbPlayer.nickname, this.config.nicknameThreshold);
    }
    
    // Year of birth matching (important)
    const websiteYearOfBirth = websitePlayer.year_of_birth || this.extractYearOfBirth(websitePlayer.birth_date) || 1900;
    const afpbYearOfBirth = afpbPlayer.year_of_birth;
    
    if (websiteYearOfBirth && afpbYearOfBirth) {
      const yearDiff = Math.abs(websiteYearOfBirth - afpbYearOfBirth);
      if (yearDiff <= this.config.maxYearDifference) {
        // Calculate score based on year difference
        scores.yearOfBirth = Math.max(0, 1 - (yearDiff * this.config.yearDiffPenalty));
      } else {
        scores.yearOfBirth = 0; // Too far apart
      }
    }
    
    // Calculate weighted average - all scores contribute proportionally
    const totalScore = (scores.name * this.config.weights.name) + 
                      (scores.nickname * this.config.weights.nickname) + 
                      (scores.club * this.config.weights.club) +
                      (scores.yearOfBirth * this.config.weights.yearOfBirth);
    
    if (this.config.debug && totalScore > 0.3) {
      console.log(`      Score breakdown for "${websitePlayer.name}" vs "${afpbPlayer.name}":`);
      console.log(`        Name: ${scores.name.toFixed(3)} (weight: ${this.config.weights.name})`);
      console.log(`        Nickname: ${scores.nickname.toFixed(3)} (weight: ${this.config.weights.nickname})`);
      console.log(`        Year: ${scores.yearOfBirth.toFixed(3)} (weight: ${this.config.weights.yearOfBirth})`);
      console.log(`        Total: ${totalScore.toFixed(3)}`);
    }
    
    return totalScore;
  }

  /**
   * Get detailed match information
   */
  getMatchDetails(websitePlayer, afpbPlayer) {
    const websiteYearOfBirth = websitePlayer.year_of_birth || this.extractYearOfBirth(websitePlayer.birth_date);
    const afpbYearOfBirth = afpbPlayer.year_of_birth;
    
    return {
      nameMatch: this.enhancedNameMatch(websitePlayer.name, afpbPlayer.name, this.config.nameThreshold),
      nicknameMatch: websitePlayer.nickname && afpbPlayer.nickname ? 
        this.fuzzyMatch(websitePlayer.nickname, afpbPlayer.nickname, this.config.nicknameThreshold) : 0,
      yearOfBirthMatch: websiteYearOfBirth === afpbYearOfBirth,
      yearDifference: Math.abs((websiteYearOfBirth || 0) - (afpbYearOfBirth || 0)),
      websiteYearOfBirth: websiteYearOfBirth,
      afpbYearOfBirth: afpbYearOfBirth
    };
  }

  /**
   * Process players and generate update/create/remove actions
   * @param {Array} websitePlayers - Players from website API
   * @param {Array} afpbPlayers - Players from AFPB scraping
   * @param {Map} successfullyScrapedClubs - Map of clubs that were successfully scraped (optional)
   * @returns {Object} - Match results
   */
  async processPlayerMatching(websitePlayers, afpbPlayers, successfullyScrapedClubs = null) {
    console.log('🔍 Starting player matching process...');
    console.log(`   Website players: ${websitePlayers.length}`);
    console.log(`   AFPB players: ${afpbPlayers.length}`);
    
    // Reset results
    this.matchResults = {
      updates: [],
      creates: [],
      removes: [],
      matches: [],
      unmatched: []
    };
    
    const matchedWebsitePlayers = new Set();
    
    // Step 1: Try to match each AFPB player with website players
    for (let i = 0; i < afpbPlayers.length; i++) {
      const afpbPlayer = afpbPlayers[i];
      
      if ((i + 1) % 100 === 0) {
        console.log(`   Processed ${i + 1}/${afpbPlayers.length} AFPB players...`);
      }
      
      const match = this.findBestMatch(afpbPlayer, websitePlayers);

      if (match) {
        matchedWebsitePlayers.add(match.websitePlayer.id);
        
        // Check if club names are different
        const websiteClub = match.player.club_name || '';
        const afpbClub = afpbPlayer.club_name || '';

        const shouldUpdate = websiteClub.toLowerCase().trim() !== afpbClub.toLowerCase().trim() ||
          afpbPlayer.name != match.websitePlayer.name;
        
        if (shouldUpdate) {
          this.matchResults.updates.push({
            action: 'update',
            website_player_id: match.websitePlayer.id,
            match_score: match.score,
            match_details: match.matchDetails,
            name: afpbPlayer.name,
            nickname: afpbPlayer.nickname,
            picture_url: afpbPlayer.picture_url,
            age: afpbPlayer.age,
            club_name: afpbPlayer.club_name,
            year_of_birth: afpbPlayer.year_of_birth,
            unique_id: afpbPlayer.unique_id,
            scraped_at: afpbPlayer.scraped_at,
            team: afpbPlayer.team || null,
            previous_club: websiteClub,
            club_name_afpb: afpbPlayer.club_name_afpb
          });
        }
        
        this.matchResults.matches.push({
          website_player: match.websitePlayer,
          afpb_player: afpbPlayer,
          match_score: match.score,
          club_changed: websiteClub.toLowerCase().trim() !== afpbClub.toLowerCase().trim(),
          website_club: websiteClub,
          afpb_club: afpbClub
        });
      } else {
        // AFPB player not matched - mark for creation
        this.matchResults.creates.push({
          action: 'create',
          name: afpbPlayer.name,
          nickname: afpbPlayer.nickname,
          picture_url: afpbPlayer.picture_url,
          age: afpbPlayer.age,
          club_name: afpbPlayer.club_name,
          year_of_birth: afpbPlayer.year_of_birth,
          unique_id: afpbPlayer.unique_id,
          scraped_at: afpbPlayer.scraped_at,
          club_name_afpb: afpbPlayer.club_name_afpb,
          team: afpbPlayer.team
        });
      }
    }
    
    // Step 2: Find website players that weren't matched (potential removals)
    for (const websitePlayer of websitePlayers) {
      if (!matchedWebsitePlayers.has(websitePlayer.id)) {
        this.matchResults.unmatched.push(websitePlayer);
      }
    }
    
    // Step 3: Process unmatched website players for potential removal
    if (config.playerMatching.removePlayers && successfullyScrapedClubs && this.matchResults.unmatched.length > 0) {
      console.log(`\n🔍 Checking ${this.matchResults.unmatched.length} unmatched website players for potential removal...`);
      
      for (let i = this.matchResults.unmatched.length - 1; i >= 0; i--) {
        const unmatchedPlayer = this.matchResults.unmatched[i];
        const playerClub = unmatchedPlayer.current_club_name || '';
        
        // Check if this player's club was successfully scraped
        if (playerClub && successfullyScrapedClubs.has(playerClub)) {
          const clubInfo = successfullyScrapedClubs.get(playerClub);
          
          // We successfully scraped this club and the player wasn't found
          // This means they likely left the club - create a remove action
          this.matchResults.removes.push({
            action: 'remove',
            website_player_id: unmatchedPlayer.id,
            name: unmatchedPlayer.name,
            nickname: unmatchedPlayer.nickname,
            previous_club: playerClub,
            club_name: 'no_club',
            reason: 'Player not found in successfully scraped club data',
            club_scraped_info: {
              club_name: clubInfo.resolvedName,
              afpb_name: clubInfo.afpbName,
              players_found: clubInfo.playersCount,
              scraped_at: clubInfo.scrapedAt
            }
          });
          
          // Remove from unmatched since we're creating an action for them
          this.matchResults.unmatched.splice(i, 1);
        }
      }
    }
    
    return this.matchResults;
  }

  /**
   * Save matching results to JSON lines file
   * @param {string} filename - Output filename
   * @returns {Object} - File save results
   */
  async saveMatchingResults(filename = 'player_actions.jsonl') {
    const outputDir = './data';
    const filePath = path.join(outputDir, filename);
    
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      // Combine updates, creates, and removes
      const allActions = [...this.matchResults.updates, ...this.matchResults.creates, ...this.matchResults.removes];
      
      if (allActions.length === 0) {
        console.log('ℹ️  No actions to save - all players are up to date');
        return null;
      }
      
      // Convert to JSON lines format
      const jsonLines = allActions.map(action => JSON.stringify(action)).join('\n');
      
      // Write to file
      await fs.writeFile(filePath, jsonLines, 'utf8');
      
      console.log(`💾 Player actions saved to: ${filePath}`);
      
      return {
        filePath: filePath,
        totalActions: allActions.length,
        updates: this.matchResults.updates.length,
        creates: this.matchResults.creates.length,
        removes: this.matchResults.removes.length
      };
      
    } catch (error) {
      console.error('❌ Failed to save matching results:', error.message);
      throw error;
    }
  }

  /**
   * Get matching statistics
   * @returns {Object} - Matching statistics
   */
  getMatchingStats() {
    return {
      total_matches: this.matchResults.matches.length,
      club_changes: this.matchResults.updates.length,
      new_players: this.matchResults.creates.length,
      removed_players: this.matchResults.removes.length,
      unmatched_website_players: this.matchResults.unmatched.length,
      actions_total: this.matchResults.updates.length + this.matchResults.creates.length + this.matchResults.removes.length
    };
  }

  /**
   * Print detailed matching statistics
   */
  printMatchingStats() {
    const stats = this.getMatchingStats();
    
    console.log('\n🎯 Player Matching Statistics:');
    console.log(`   Total matches found: ${stats.total_matches}`);
    console.log(`   Players needing club updates: ${stats.club_changes}`);
    console.log(`   New players to create: ${stats.new_players}`);
    console.log(`   Players to remove (set to no_club): ${stats.removed_players}`);
    console.log(`   Unmatched website players: ${stats.unmatched_website_players}`);
    console.log(`   Total actions generated: ${stats.actions_total}`);
    
    if (this.matchResults.updates.length > 0) {
      console.log('\n📝 Sample Club Updates:');
      this.matchResults.updates.slice(0, 5).forEach(update => {
        console.log(`   "${update.name}" (${update.previous_club} → ${update.club_name})`);
      });
      if (this.matchResults.updates.length > 5) {
        console.log(`   ... and ${this.matchResults.updates.length - 5} more`);
      }
    }
    
    if (this.matchResults.creates.length > 0) {
      console.log('\n👤 Sample New Players:');
      this.matchResults.creates.slice(0, 5).forEach(create => {
        console.log(`   "${create.name}" (${create.club_name})`);
      });
      if (this.matchResults.creates.length > 5) {
        console.log(`   ... and ${this.matchResults.creates.length - 5} more`);
      }
    }
    
    if (this.matchResults.removes.length > 0) {
      console.log('\n🔴 Sample Removed Players:');
      this.matchResults.removes.slice(0, 5).forEach(remove => {
        console.log(`   "${remove.name}" (${remove.previous_club} → no_club)`);
      });
      if (this.matchResults.removes.length > 5) {
        console.log(`   ... and ${this.matchResults.removes.length - 5} more`);
      }
    }
  }
}

module.exports = PlayerMatchingService; 