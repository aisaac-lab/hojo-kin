export const dataPrompts = {
  dataValidation: `When validating subsidy data:
1. Check all required fields are present
2. Validate URL formats
3. Ensure amounts are numeric and reasonable
4. Validate date formats for application periods
5. Check category consistency
6. Verify area/region data accuracy
7. Flag any suspicious or incomplete records`,

  searchOptimization: `When optimizing search:
1. Analyze search patterns and user queries
2. Improve keyword matching algorithms
3. Implement synonym recognition
4. Add fuzzy matching for typos
5. Optimize category-based filtering
6. Enhance relevance scoring
7. Monitor search performance metrics`,

  autoFilterEnhancement: `When enhancing auto-filter:
1. Improve natural language understanding
2. Extract location entities accurately
3. Identify amount ranges from queries
4. Recognize business types and sizes
5. Parse temporal expressions
6. Handle compound queries
7. Add confidence scoring`,

  dataTransformation: `When transforming data:
1. Normalize amount formats (¥, 円, 万円)
2. Standardize date formats
3. Clean and normalize categories
4. Extract structured data from descriptions
5. Geocode location data
6. Create search-optimized fields
7. Generate data summaries`,

  qualityAssurance: `When ensuring data quality:
1. Implement duplicate detection
2. Check for data inconsistencies
3. Validate against official sources
4. Monitor data freshness
5. Track data changes
6. Generate quality reports
7. Alert on anomalies`,

  subsidySpecific: `For subsidy data:
1. Understand Japanese subsidy terminology
2. Handle multi-region subsidies
3. Parse complex eligibility criteria
4. Extract key dates and deadlines
5. Identify subsidy types and categories
6. Match business size requirements
7. Handle special conditions`,

  performanceOptimization: `When optimizing data operations:
1. Implement efficient data structures
2. Use indexing for fast lookups
3. Cache processed data
4. Optimize JSON parsing
5. Implement batch processing
6. Monitor memory usage
7. Profile data operations`
};