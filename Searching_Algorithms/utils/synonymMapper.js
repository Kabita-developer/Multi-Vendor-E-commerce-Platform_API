/**
 * Bengali to English synonym mapping
 * Maps Bengali terms to their English equivalents for MongoDB search
 */
const BENGALI_SYNONYMS = {
  // Phone related
  'ফোন': ['phone', 'mobile', 'smartphone', 'cellphone'],
  'মোবাইল': ['phone', 'mobile', 'smartphone', 'cellphone'],
  
  // Fan related
  'পাখা': ['fan', 'ventilator', 'ceiling fan'],
  
  // Rice related
  'চাল': ['rice', 'chawal'],
  
  // Oil related
  'তেল': ['oil', 'cooking oil'],
  
  // Shoes related
  'জুতো': ['shoes', 'footwear'],
  
  // Laptop related
  'ল্যাপটপ': ['laptop', 'notebook'],
  
  // TV related
  'টিভি': ['tv', 'television'],
  
  // Fridge related
  'রেফ্রিজারেটর': ['fridge', 'refrigerator'],
  
  // Washing machine related
  'ওয়াশিং মেশিন': ['washing machine', 'washer'],
  
  // AC related
  'এসি': ['ac', 'air conditioner', 'cooler'],
};

/**
 * Get English synonyms for a Bengali term
 * @param {String} term - Bengali or English term
 * @returns {Array} Array of search terms (original + synonyms)
 */
function getSynonyms(term) {
  if (!term || typeof term !== 'string') {
    return [];
  }

  const trimmedTerm = term.trim().toLowerCase();
  const searchTerms = [trimmedTerm]; // Always include original term

  // Check if term is Bengali (contains Bengali characters)
  const isBengali = /[\u0980-\u09FF]/.test(trimmedTerm);

  if (isBengali) {
    // Find matching Bengali synonyms
    for (const [bengali, englishSynonyms] of Object.entries(BENGALI_SYNONYMS)) {
      if (trimmedTerm.includes(bengali) || bengali.includes(trimmedTerm)) {
        searchTerms.push(...englishSynonyms);
        break; // Use first match
      }
    }
  } else {
    // For English terms, find reverse mapping
    for (const [bengali, englishSynonyms] of Object.entries(BENGALI_SYNONYMS)) {
      if (englishSynonyms.some(syn => trimmedTerm.includes(syn) || syn.includes(trimmedTerm))) {
        searchTerms.push(...englishSynonyms);
        searchTerms.push(bengali); // Also include Bengali term
        break;
      }
    }
  }

  // Remove duplicates and return
  return [...new Set(searchTerms)];
}

/**
 * Expand search query with synonyms
 * @param {String} query - Original search query
 * @returns {Array} Array of search terms to use in MongoDB $or query
 */
function expandQueryWithSynonyms(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const trimmedQuery = query.trim();
  
  // Split query into words (handles both Bengali and English)
  const words = trimmedQuery.split(/\s+/);
  
  // Get synonyms for each word
  const allTerms = [];
  for (const word of words) {
    const synonyms = getSynonyms(word);
    allTerms.push(...synonyms);
  }
  
  // Always include the original query
  allTerms.push(trimmedQuery);
  
  // Remove duplicates
  return [...new Set(allTerms)];
}

module.exports = {
  getSynonyms,
  expandQueryWithSynonyms,
  BENGALI_SYNONYMS,
};

