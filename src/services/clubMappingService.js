const axios = require('axios');
const config = require('../config');

const hardCodedMappings = {
  'Associação Desportiva Recreativa Juventude S.Martinho': 'S. Martinho',
  'Associação Desportiva, Cultural e Recreativa Águias de S.Mamede': 'S. Mamede',
  'Associação Baluganense de Cultura e Desporto': 'Baluganense',
  'Lijó Futebol Clube': 'Lijó',
  'Associação Desportiva de Chorente': 'Chorente',
  'Associação Cultural Desportiva Carapeços': 'Carapeços',
  'Associação Cultural Desportiva e Recreativa de Cambeses': 'Cambeses',
  'Associação Cultural Desportiva Pereira': 'Pereira',
  'Associação Cultural Recreativa e Desportiva de Carvalhas': 'Carvalhas',
  'Associação Desportiva Cultural e Recreativa de Silveiros': 'Silveiros',
  'Associação Desportiva Cultural Grimancelos': 'Grimancelos',
  'Associação Desportiva de Carvalhal': 'Carvalhal',
  'Associação Desportiva de Milhazes': 'Milhazes',
  'Associação Desportiva e Cultural Bastuço S. João': 'Bastuço S. João',
  'Associação Desportiva e Cultural de Remelhe': 'Remelhe',
  'Associação Desportiva Recreativa e Cultural de Fonte Coberta': 'Fonte Coberta',
  'Associação Recreativa e Cultural da Várzea': 'Várzea',
  'Associação Recreativa e Cultural de Cossourado': 'Cossourado',
  'Associação Recreativa e Cultural de Sequeade': 'Sequeade',
  'Futebol Clube Negreiros': 'Negreiros',
  'Futebol Clube Oliveira': 'Oliveira',
  'Grupo Desportivo Águas Santas': 'Águas Santas',
  'Grupo Desportivo de Creixomil': 'Creixomil',
  'Grupo Desportivo de Feitos': 'Feitos',
  'Grupo Desportivo de Fragoso': 'Fragoso',
  'Grupo Desportivo de Pedra Furada': 'Pedra Furada',
  'Grupo Desportivo e Cultural de Cristelo': 'Cristelo',
  'Grupo Desportivo e Recreativo "Os Estrelas"': 'Estrelas S. Pedro',
  'Grupo Desportivo e Recreativo «Os Moínhos» de Paradela': 'Paradela',
  'Grupo Desportivo e Recreativo de Campo': 'GDR Campo',
  'Grupo Desportivo Macieira': 'Macieira',
  'Grupo Desportivo,Recreativo Leocadenses': 'Leocadenses',
  'Juventude Cultural Recreativa de Perelhal': 'Perelhal',
  'Leões da Serra Futebol Clube': 'Leões da Serra',
  'Necessidades Futebol Clube': 'Necessidades',
  'Núcleo Desportivo Águias do Neiva': 'Águias do Neiva',
  'Nùcleo Desportivo Águias do Neiva': 'Águias do Neiva',
  'Núcleo Desportivo da Silva': 'Silva',
  'Núcleo Desportivo Os Andorinhas': 'Andorinhas',
  'Núcleo Desportivo Sta. Eugénia': 'ND Sta. Eugénia',
  'Palme Futebol Clube': 'Palme',
  'União Cultural e Recreativa de Aborim': 'Aborim',
  'Associação desportiva R.e Cultural Futebol Clube Lirio do Neiva': 'FC Lírio do Neiva',
  'MARCA: Movimento Associativo R.Cultura e Arte Vila Cova': 'MARCA',
  'Associação Cultural Desportiva São Miguel de Laundos': 'Laúndos',
  'Vila Fria Mil Novecentos Oitenta': 'Vila Fria 1980',
  'Associação Desportiva Cultural de Balasar': 'ADC Balasar',
  'Grupo Desportivo de Apulia': 'GD Apúlia',
  'Associação Juvenil da Estela': 'Estela',
  'Clube Caçadores Os Torreenses': 'Os Torreenses',
  'Futebol Clube de Areias São Vicente': 'Areias São Vicente',
  'União Futebol Clube': 'União FC',
  'A União desportiva de São Mamede': 'UD São Mamede',
  'Associação Desportiva Águias da Graça Futebol Clube': 'Águias da Graça'
}

class ClubMappingService {
  constructor() {
    this.clubNameCache = new Map(); // Cache for AFPB name -> website name mapping
    this.client = axios.create({
      timeout: config.api.timeout,
      headers: {
        'Authorization': config.api.token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Resolves an AFPB club name to the corresponding name on the user's website
   * @param {string} afpbClubName - The club name from AFPB website
   * @returns {Promise<string>} - The resolved club name from user's website
   */
  async resolveClubName(afpbClubName) {
    // Check cache first
    if (this.clubNameCache.has(afpbClubName)) {
      console.log(`   📋 Using cached mapping: "${afpbClubName}" -> "${this.clubNameCache.get(afpbClubName)}"`);
      return this.clubNameCache.get(afpbClubName);
    }

    if (hardCodedMappings[afpbClubName]) {
      console.log(`   📋 Using hardcoded mapping: "${afpbClubName}" -> "${hardCodedMappings[afpbClubName]}"`);
      this.clubNameCache.set(afpbClubName, hardCodedMappings[afpbClubName]);
      return hardCodedMappings[afpbClubName];
    }

    try {
      console.log(`   🔍 Searching for club: "${afpbClubName}"`);
      
      // Call the club search API
      const encodedClubName = encodeURIComponent(afpbClubName);
      const response = await this.client.get(`${config.api.baseUrl}/clubs/search?name=${encodedClubName}`);
      
      const { data } = response.data;
      
      if (data && data.length > 0) {
        // Get the best match (first result, which should have the highest score)
        const bestMatch = data[0];
        const resolvedName = bestMatch.name;
        const matchScore = bestMatch.match_score;
        
        console.log(`   ✅ Found club mapping: "${afpbClubName}" -> "${resolvedName}" (score: ${matchScore.toFixed(3)})`);
        
        // Cache the mapping
        this.clubNameCache.set(afpbClubName, resolvedName);
        
        return resolvedName;
      } else {
        console.log(`   ⚠️  No club found for: "${afpbClubName}" - trying local hardcoded mapping`);

        if (hardCodedMappings[afpbClubName]) {
          console.log(`   ✅ Found club mapping: "${afpbClubName}" -> "${hardCodedMappings[afpbClubName]}"`);
          this.clubNameCache.set(afpbClubName, hardCodedMappings[afpbClubName]);
          return hardCodedMappings[afpbClubName];
        } else {
          console.log(`   ⚠️  No club found for: "${afpbClubName}" - using original name`);
        }
        
        // Cache the original name so we don't keep trying
        this.clubNameCache.set(afpbClubName, afpbClubName);
        
        return afpbClubName;
      }
      
    } catch (error) {
      console.warn(`   ❌ Error searching for club "${afpbClubName}": ${error.message}`);
      
      // On error, use original name and cache it
      this.clubNameCache.set(afpbClubName, afpbClubName);
      
      return afpbClubName;
    }
  }

  /**
   * Get the current cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.clubNameCache.size,
      mappings: Array.from(this.clubNameCache.entries()).map(([afpb, website]) => ({
        afpb_name: afpb,
        website_name: website,
        is_mapped: afpb !== website
      }))
    };
  }

  /**
   * Clear the club name cache
   */
  clearCache() {
    this.clubNameCache.clear();
    console.log('🗑️  Club name cache cleared');
  }

  /**
   * Preload club mappings from a list of AFPB club names
   * @param {string[]} afpbClubNames - Array of AFPB club names to preload
   */
  async preloadMappings(afpbClubNames) {
    console.log(`🔄 Preloading ${afpbClubNames.length} club name mappings...`);
    
    const uniqueNames = [...new Set(afpbClubNames)];
    const promises = uniqueNames.map(name => this.resolveClubName(name));
    
    try {
      await Promise.all(promises);
      console.log(`✅ Preloaded ${uniqueNames.length} club mappings`);
    } catch (error) {
      console.warn(`⚠️  Some club mappings failed to preload: ${error.message}`);
    }
  }
}

module.exports = ClubMappingService; 