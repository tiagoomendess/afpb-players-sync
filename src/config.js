require('dotenv').config();

const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8000/api',
    token: process.env.API_TOKEN || '',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000 // 1 second
  },
  output: {
    dir: process.env.OUTPUT_DIR || './data',
    playersFile: process.env.PLAYERS_FILE || 'players.jsonl'
  },
  pagination: {
    defaultPerPage: parseInt(process.env.DEFAULT_PER_PAGE) || 100,
    maxPerPage: 500
  },
  sync: {
    // Number of concurrent requests when updating players (2-5 recommended)
    updateConcurrency: parseInt(process.env.UPDATE_CONCURRENCY) || 1
  },
  scraping: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    requestDelay: 1000, // 1 second between requests
    clubsListUrl: process.env.CLUBS_LIST_URL || 'https://afpbarcelos.pt/clubes',
    maxRetries: 3,
    retryDelay: 3000, // 2 seconds between retries
    
    // Number of concurrent club scraping requests (2-5 recommended)
    scrapingConcurrency: parseInt(process.env.SCRAPING_CONCURRENCY) || 3,
    
    // CSS Selectors for web scraping
    // Instructions:
    // 1. Go to https://afpbarcelos.pt/clubes in your browser
    // 2. Right-click on elements and "Inspect Element" to find the correct selectors
    // 3. Replace the placeholder values below with actual CSS selectors
    // 4. Test with: node src/sync-players.js --mode scrape-only --scraping-max-clubs 1
    selectors: {
      // CLUBS LIST PAGE SELECTORS (https://afpbarcelos.pt/clubes)
      clubs: {
        listSelector: '.ranking-wrap > tbody:nth-child(2) > tr',
        nameSelector: '.club-item > a > strong',
        urlSelector: '.club-item > a'
      },
      
      // CLUB PLAYERS PAGE SELECTORS (individual club pages)
      players: {
        listSelector: 'div.match-details:nth-child(1) > div:nth-child(2) > div:nth-child(1) > table > tbody > tr',      // e.g., '.players-list .player'
        nameSelector: '.table__td__link > .table__td__player__content > span:nth-child(1)',       // e.g., '.player-name'
        transferedSelector: '.table__td__link > .table__td__player__content > .table__td__player__meta',
        pictureSelector: '.table__td__player__img > div > img', // e.g., '.player-photo img'
        ageSelector: 'td > span.badge-light'          // e.g., '.player-age'
      }
    }
  },
  
  // Player matching configuration (fuzzy matching parameters)
  playerMatching: {
    removePlayers: false,

    // Overall minimum score to consider a match (0-1)
    minMatchScore: 0.70,
    
    // Fuzzy string matching thresholds (0-1) - DEPRECATED: kept for compatibility but no longer used for binary cutoffs
    // All similarity scores now contribute proportionally to the final weighted score
    nameThreshold: 0.55,
    nicknameThreshold: 0.95,
    
    // Score weights (should sum to 1.0)
    weights: {
      name: 0.60,
      club: 0.1,
      nickname: 0,
      yearOfBirth: 0.3
    },
    
    // Year of birth matching (exact match only)
    maxYearDifference: 2,
    yearDiffPenalty: 0.3333,
    
    // Debug mode
    debug: false
  }
};

// Helper functions for selector validation
function validateSelectors() {
  const errors = [];
  
  // Check clubs selectors
  Object.entries(config.scraping.selectors.clubs).forEach(([key, value]) => {
    if (!value || value.startsWith('REPLACE_WITH_')) {
      errors.push(`scraping.selectors.clubs.${key} needs to be configured`);
    }
  });
  
  // Check players selectors  
  Object.entries(config.scraping.selectors.players).forEach(([key, value]) => {
    if (!value || value.startsWith('REPLACE_WITH_')) {
      errors.push(`scraping.selectors.players.${key} needs to be configured`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function getConfigurationInstructions() {
  return `
🔧 CSS Selectors Configuration Required

Before web scraping can work, you need to configure the CSS selectors.

Steps:
1. Open your browser and go to https://afpbarcelos.pt/clubes
2. Right-click on elements and select "Inspect Element"
3. Find the CSS selectors for the table/list elements
4. Edit src/config.js and replace the REPLACE_WITH_* values in config.scraping.selectors
5. Test with: node src/sync-players.js --mode scrape-only --scraping-max-clubs 1

Example selectors you might find:
- Clubs list: 'table tbody tr' or '.clubs-table tr'
- Club name: 'td:first-child a' or '.club-name'
- Club URL: 'td:first-child a' or '.club-link'

For individual club pages:
- Players list: '.players .player' or 'table tbody tr'
- Player name: '.player-name' or 'td:nth-child(1)'
- Player picture: '.player-photo img' or 'img'
- Player age: '.player-age' or 'td:nth-child(2)'
`;
}

// Helper function to validate required environment variables
function validateEnvironmentVariables() {
  const errors = [];
  
  if (!process.env.API_TOKEN) {
    errors.push('API_TOKEN is required but not set. Please add it to your .env file.');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  ...config,
  validateSelectors,
  getConfigurationInstructions,
  validateEnvironmentVariables
};
