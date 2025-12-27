# AFPB Players Sync

A Node.js tool to sync player data from your AFPB website API to local storage, with plans to extend for web scraping and data comparison.

## Features

- 🚀 Fetch all players from paginated API endpoints
- 🕷️ Web scraping of AFPB website for additional player data
- 🔄 Full sync mode combining both API and web scraping
- 💾 Save data in JSON Lines format for easy processing
- 🔄 Support for incremental saves during long-running operations
- ⚙️ Configurable batch sizes and pagination controls
- 🛡️ Built-in retry logic and error handling
- 📊 Summary statistics and progress tracking
- 🎯 Selective club processing with skip and limit options
- 🗓️ Scheduled automatic sync on Mondays and Fridays at 22:00

## Installation

1. Clone or create the project directory
2. Install dependencies:

```bash
npm install
```

## Configuration

### Environment Variables

**Required:** Create a `.env` file in the root directory with your API credentials:

```bash
# Copy the example file and edit it
cp .env.example .env
# Edit the .env file with your actual API token
```

**Example `.env` file:**
```bash
# API Configuration (REQUIRED)
API_BASE_URL=http://localhost:8000/api
API_TOKEN=your_actual_api_token_here

# Output Configuration (OPTIONAL)
OUTPUT_DIR=./data
PLAYERS_FILE=players.jsonl

# Pagination Configuration (OPTIONAL)
DEFAULT_PER_PAGE=100

# Web Scraping Configuration (OPTIONAL)
CLUBS_LIST_URL=https://afpbarcelos.pt/clubes
```

### Default Configuration

The system uses these defaults if no environment variables are set:

- **API Base URL**: `http://localhost:8000/api`
- **API Token**: **(REQUIRED - must be set in .env file)**
- **Output Directory**: `./data`
- **Players File**: `players.jsonl`
- **Default Per Page**: `100`
- **Clubs List URL**: `https://afpbarcelos.pt/clubes`

⚠️ **Important:** The API token must be provided via the `.env` file for security reasons.

## Usage

### Quick Start

**API Only** (fetch from your website):
```bash
npm run sync:api
# or
npm run sync  # default mode
```

**Web Scraping Only** (scrape AFPB website):
```bash
npm run sync:scrape
```

**Full Sync** (API + Web scraping):
```bash
npm run sync:full
```

**Scheduled Sync** (automatic on Mondays and Fridays at 22:00):
```bash
npm run schedule
```

Or use directly:
```bash
node src/sync-players.js --mode full
```

### Command Line Options

**API Examples:**
```bash
# API only - fetch first 5 pages
node src/sync-players.js --mode api-only --max-pages 5

# API with custom batch size
node src/sync-players.js --batch-size 50 --incremental
```

**Web Scraping Examples:**
```bash
# Scrape only first 3 clubs
node src/sync-players.js --mode scrape-only --scraping-max-clubs 3

# Scrape with custom output file
node src/sync-players.js --mode scrape-only --scraping-output my_scraped_data.jsonl

# Skip specific clubs
node src/sync-players.js --mode scrape-only --skip-clubs "FOLGA,Test Club"
```

**Full Sync Examples:**
```bash
# Full sync with limits for testing
node src/sync-players.js --mode full --max-pages 3 --scraping-max-clubs 2

# Full sync with incremental saves
node src/sync-players.js --mode full --incremental
```

**Scheduled Sync Examples:**
```bash
# Start the scheduler (runs in foreground)
npm run schedule

# Test the scheduled sync immediately (run once and exit)
npm run schedule:test

# Run sync immediately, then continue with schedule
npm run schedule:run-now

# Show scheduler help
node src/scheduler.js --help
```

**General:**
```bash
# Show help
node src/sync-players.js --help
```

### Available Options

- `--start-page <number>`: Start from specific page (default: 1)
- `--max-pages <number>`: Maximum pages to fetch (default: all)
- `--batch-size <number>`: Players per page (default: 100)
- `--incremental`: Save data incrementally as it's fetched
- `--output <filename>`: Output filename (default: players.jsonl)
- `--help`: Show help message

## Programmatic Usage

```javascript
const { PlayerSyncService } = require('./src');

async function example() {
  const syncService = new PlayerSyncService();
  
  // Fetch all players
  const players = await syncService.fetchAllPlayers();
  
  // Save to file
  await syncService.savePlayersToFile();
  
  // Get summary
  const summary = syncService.getPlayersSummary();
  console.log('Summary:', summary);
}
```

## Data Format

### API Response Structure

The API returns data in this format:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Hugo Pombo",
      "picture": "/storage/media/images/fbu1536713894qfb-hugo-pombo.png",
      "nickname": "Raposo", 
      "birth_date": "1998-07-12 00:00:00",
      "age": 26,
      "current_club_name": "Roriz",
      "association_id": "15332331"
    }
  ],
  "pagination": {
    "current_page": 1,
    "last_page": 1614,
    "per_page": "1", 
    "total": 1614,
    "from": 1,
    "to": 1
  }
}
```

### Output Format

**API Data** (`players.jsonl`):
```
{"id":1,"name":"Hugo Pombo","picture":"/storage/media/images/fbu1536713894qfb-hugo-pombo.png","nickname":"Raposo","birth_date":"1998-07-12 00:00:00","age":26,"current_club_name":"Roriz","association_id":"15332331"}
{"id":2,"name":"Another Player","picture":null,"nickname":"Nick","birth_date":"1995-03-15 00:00:00","age":29,"current_club_name":"Another Club","association_id":"15332332"}
```

**Scraped Data** (`scraped_players.jsonl`):
```
{"name":"João Silva","picture_url":"https://afpbarcelos.pt/images/player123.jpg","age":25,"club_name":"FC NEGREIROS","club_url":"https://afpbarcelos.pt/clube/fc-negreiros","scraped_at":"2024-01-15T10:30:00.000Z"}
{"name":"Pedro Santos","picture_url":null,"age":28,"club_name":"GD FRAGOSO","club_url":"https://afpbarcelos.pt/clube/gd-fragoso","scraped_at":"2024-01-15T10:30:15.000Z"}
```

## Project Structure

```
afpb_players_sync/
├── src/
│   ├── config.js                 # Configuration management
│   ├── index.js                  # Main library entry point
│   ├── sync-players.js           # Command-line interface
│   ├── scheduler.js              # Scheduled sync (Mon/Fri 22:00)
│   ├── services/
│   │   └── playerSyncService.js  # Main sync service
│   └── utils/
│       ├── apiClient.js          # HTTP client with retry logic
│       └── fileUtils.js          # File operations utilities
├── data/                         # Output directory (created automatically)
├── package.json
└── README.md
```

## Scheduled Sync

The scheduler runs the full sync automatically on **Mondays and Fridays at 22:00** (10 PM).

### Starting the Scheduler

```bash
npm run schedule
```

This starts a background process that waits for the scheduled time and runs the full sync. Keep the terminal open for the scheduler to work.

### Scheduler Options

| Command | Description |
|---------|-------------|
| `npm run schedule` | Start the scheduler (waits for Monday/Friday 22:00) |
| `npm run schedule:test` | Run sync immediately once and exit (for testing) |
| `npm run schedule:run-now` | Run sync immediately, then continue with schedule |

### Production Deployment

For production use, consider using a process manager:

**Using PM2:**
```bash
npm install -g pm2
pm2 start src/scheduler.js --name "afpb-sync-scheduler"
pm2 save
pm2 startup  # Enable auto-start on system boot
```

**Using systemd (Linux):**
Create a service file at `/etc/systemd/system/afpb-scheduler.service`

### Schedule Details

- **Cron expression:** `0 22 * * 1,5`
- **Runs on:** Monday (1) and Friday (5)
- **Time:** 22:00 (10 PM) in your system's timezone

## Error Handling

The system includes comprehensive error handling:

- **Network errors**: Automatic retries with exponential backoff
- **API errors**: Graceful handling of failed requests
- **File errors**: Directory creation and permission handling
- **Pagination errors**: Continues processing even if individual pages fail

## Web Scraping Configuration

⚠️  **Important**: Before using web scraping, you need to configure the CSS selectors in `src/config.js`.

Look for the `scraping.selectors` section and replace the placeholders with actual selectors:

```javascript
// In src/config.js, find the scraping.selectors section:
selectors: {
  clubs: {
    listSelector: 'REPLACE_WITH_CLUBS_LIST_SELECTOR',    // e.g., 'table tbody tr'
    nameSelector: 'REPLACE_WITH_CLUB_NAME_SELECTOR',     // e.g., 'td:first-child a'
    urlSelector: 'REPLACE_WITH_CLUB_URL_SELECTOR'        // e.g., 'td:first-child a'
  },
  players: {
    listSelector: 'REPLACE_WITH_PLAYERS_LIST_SELECTOR',      // e.g., '.players-list .player'
    nameSelector: 'REPLACE_WITH_PLAYER_NAME_SELECTOR',       // e.g., '.player-name'
    pictureSelector: 'REPLACE_WITH_PLAYER_PICTURE_SELECTOR', // e.g., '.player-photo img'
    ageSelector: 'REPLACE_WITH_PLAYER_AGE_SELECTOR'          // e.g., '.player-age'
  }
}
```

The system will scrape [https://afpbarcelos.pt/clubes](https://afpbarcelos.pt/clubes) and each individual club page.

## Planned Features

This is the foundation for a larger sync system that will include:

1. ✅ **API Data Fetching** (Complete)
2. ✅ **Web Scraping** (Framework ready - needs CSS selectors)
3. 🔄 **Data Comparison** (Next phase)  
4. 🔄 **Automated Updates** (Next phase)
5. 🔄 **Scheduling** (Future)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 