const ClubMappingService = require('../src/services/clubMappingService');

async function testClubMapping() {
  console.log('🧪 Testing Club Mapping Service...\n');
  
  const clubMappingService = new ClubMappingService();
  
  // Test with the example club name from the user
  const testClubName = 'Associação Desportiva e Recreativa de Chorente';
  
  try {
    console.log('Testing club name resolution...');
    const resolvedName = await clubMappingService.resolveClubName(testClubName);
    
    console.log(`✅ Original: "${testClubName}"`);
    console.log(`✅ Resolved: "${resolvedName}"`);
    
    // Test cache functionality
    console.log('\nTesting cache functionality...');
    const resolvedNameCached = await clubMappingService.resolveClubName(testClubName);
    console.log(`✅ Cached result: "${resolvedNameCached}"`);
    
    // Test with a club that might not exist
    console.log('\nTesting with non-existent club...');
    const nonExistentClub = 'Non-existent Football Club Test 12345';
    const resolvedNonExistent = await clubMappingService.resolveClubName(nonExistentClub);
    console.log(`✅ Non-existent club: "${nonExistentClub}" -> "${resolvedNonExistent}"`);
    
    // Display cache statistics
    console.log('\n📊 Cache Statistics:');
    const stats = clubMappingService.getCacheStats();
    console.log(`   Total entries: ${stats.size}`);
    stats.mappings.forEach(mapping => {
      const status = mapping.is_mapped ? '✅ Mapped' : '⚠️  Not mapped';
      console.log(`   ${status}: "${mapping.afpb_name}" -> "${mapping.website_name}"`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Make sure your API server is running on http://localhost:8000');
    console.error('And that the Authorization token is correct in src/config.js');
  }
}

// Run the test
testClubMapping().catch(console.error); 