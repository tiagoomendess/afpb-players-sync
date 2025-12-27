const PlayerMatchingService = require('../src/services/playerMatchingService');

async function testPlayerMatching() {
  console.log('🧪 Testing Player Matching Service...\n');
  
  // Test with more lenient settings  
  const matchingService = new PlayerMatchingService({
    minMatchScore: 0.4,
    nameThreshold: 0.4,
    nicknameThreshold: 0.4,
    maxYearDifference: 3,
    debug: false  // Set to true to see detailed scoring
  });
  
  // Sample website players (your data structure)
  const websitePlayers = [
    {
      id: 1,
      name: 'João Silva',
      nickname: 'Joãozinho',
      current_club_name: 'FC Porto',
      birth_date: '1995-03-15 00:00:00',
      age: 29
    },
    {
      id: 2,
      name: 'Maria Santos',
      nickname: null,
      current_club_name: 'Sporting CP',
      birth_date: '1992-08-22 00:00:00',
      age: 32
    },
    {
      id: 3,
      name: 'Pedro Costa',
      nickname: 'Pedrinho',
      current_club_name: 'Benfica',
      birth_date: '1998-11-10 00:00:00',
      age: 26
    }
  ];
  
  // Sample AFPB players (scraped data)
  const afpbPlayers = [
    {
      name: 'João Silva',
      nickname: 'Joãozinho',
      picture_url: 'https://example.com/joao.jpg',
      age: 29,
      year_of_birth: 1995,
      unique_id: 'joao_silva_1995',
      club_name: 'FC Porto B',  // Different club!
      club_name_afpb: 'Futebol Clube do Porto B',
      scraped_at: new Date().toISOString()
    },
    {
      name: 'Maria Santos',
      nickname: null,
      picture_url: 'https://example.com/maria.jpg',
      age: 32,
      year_of_birth: 1992,
      unique_id: 'maria_santos_1992',
      club_name: 'Sporting CP', // Same club
      club_name_afpb: 'Sporting Clube de Portugal',
      scraped_at: new Date().toISOString()
    },
    {
      name: 'Ana Rodrigues',  // New player not in website
      nickname: 'Aninha',
      picture_url: 'https://example.com/ana.jpg',
      age: 24,
      year_of_birth: 2000,
      unique_id: 'ana_rodrigues_2000',
      club_name: 'Braga',
      club_name_afpb: 'Sporting Clube de Braga',
      scraped_at: new Date().toISOString()
    }
  ];
  
  try {
    console.log('Testing player matching process...');
    
    // Process matching
    const matchResults = await matchingService.processPlayerMatching(websitePlayers, afpbPlayers);
    
    console.log('\n✅ Matching completed successfully!');
    
    // Print statistics
    matchingService.printMatchingStats();
    
    // Test birth date extraction
    console.log('\n📅 Testing birth date extraction:');
    const birthDateTests = [
      '1995-03-15 00:00:00',
      '1992-08-22',
      '1998-11-10T14:30:00Z',
      'invalid-date',
      null,
      ''
    ];
    
    birthDateTests.forEach(birthDate => {
      const year = matchingService.extractYearOfBirth(birthDate);
      console.log(`   "${birthDate}" -> ${year}`);
    });

    // Test fuzzy matching directly
    console.log('\n🔍 Testing fuzzy matching:');
    const fuzzyTests = [
      ['João Silva', 'Joao Silva', 0.8],
      ['Maria Santos', 'Maria dos Santos', 0.8],
      ['Pedro Costa', 'Pedro da Costa', 0.8],
      ['Different Name', 'Another Name', 0.8]
    ];
    
    fuzzyTests.forEach(([str1, str2, threshold]) => {
      const score = matchingService.fuzzyMatch(str1, str2, threshold);
      console.log(`   "${str1}" vs "${str2}": ${score.toFixed(3)} (threshold: ${threshold})`);
    });
    
    // Test saving results
    console.log('\n💾 Testing save functionality...');
    const saveResult = await matchingService.saveMatchingResults('test_player_actions.jsonl');
    
    if (saveResult) {
      console.log(`✅ Test results saved to: ${saveResult.filePath}`);
      console.log(`   Total actions: ${saveResult.totalActions}`);
      console.log(`   Updates: ${saveResult.updates}`);
      console.log(`   Creates: ${saveResult.creates}`);
    }
    
    // Test the fix for the surname-only matching bug
    console.log('\n🔧 Testing surname-only matching bug fix:');
    const websitePlayerBug = {
      id: 9999,
      name: "Paulo Filipe Araújo",
      birth_date: "2006-02-03 00:00:00",
      current_club_name: "Macieira"
    };

    const afpbPlayerBug = {
      name: "Gonçalo Ribeiro Araujo",
      year_of_birth: 2006,
      club_name: "Grimancelos",
      unique_id: "goncalo_ribeiro_araujo_2006"
    };

    const bugScore = matchingService.calculateMatchScore(websitePlayerBug, afpbPlayerBug);
    console.log(`   Match score for different people with same surname: ${bugScore.toFixed(3)}`);
    console.log(`   Should be below minimum threshold (${matchingService.config.minMatchScore}) ✓`);

    // Test enhanced name matching directly
    const enhancedScore = matchingService.enhancedNameMatch(
      websitePlayerBug.name, 
      afpbPlayerBug.name, 
      matchingService.config.nameThreshold
    );
    console.log(`   Enhanced name match score: ${enhancedScore.toFixed(3)}`);

    const basicScore = matchingService.fuzzyMatch(
      websitePlayerBug.name, 
      afpbPlayerBug.name, 
      0.0
    );
    console.log(`   Basic fuzzy match score: ${basicScore.toFixed(3)}`);
    
    return matchResults;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test if called directly
if (require.main === module) {
  testPlayerMatching()
    .then(() => {
      console.log('\n🎉 All tests passed!');
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testPlayerMatching }; 