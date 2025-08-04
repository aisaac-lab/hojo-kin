export const backendPrompts = {
  apiRouteCreation: `When creating API routes:
1. Use proper HTTP methods (GET, POST, PUT, DELETE)
2. Implement request validation
3. Add comprehensive error handling
4. Return appropriate status codes
5. Include proper TypeScript types
6. Add rate limiting where necessary
7. Log important operations`,

  databaseOptimization: `When working with database:
1. Use Drizzle ORM methods efficiently
2. Implement proper indexes
3. Use transactions for related operations
4. Add data validation
5. Implement soft deletes where appropriate
6. Use prepared statements
7. Monitor query performance`,

  openAIIntegration: `When working with OpenAI API:
1. Handle API errors gracefully
2. Implement retry logic with exponential backoff
3. Monitor token usage
4. Cache responses where appropriate
5. Use streaming for long responses
6. Implement timeout handling
7. Log API interactions for debugging`,

  performanceOptimization: `When optimizing backend performance:
1. Implement response caching
2. Use database connection pooling
3. Optimize query patterns
4. Implement lazy loading
5. Use background jobs for heavy tasks
6. Monitor memory usage
7. Profile and optimize bottlenecks`,

  securityImplementation: `When implementing security:
1. Validate all inputs
2. Sanitize user data
3. Implement rate limiting
4. Use environment variables for secrets
5. Add request authentication
6. Implement CORS properly
7. Log security events`,

  reviewAgentSpecific: `For the review agent:
1. Implement comprehensive scoring logic
2. Add configurable thresholds
3. Handle edge cases gracefully
4. Provide actionable feedback
5. Log review decisions
6. Implement fallback strategies
7. Monitor review performance`,

  errorHandling: `When handling errors:
1. Create custom error classes
2. Implement error boundaries
3. Log errors with context
4. Return user-friendly messages
5. Implement recovery strategies
6. Monitor error rates
7. Add error reporting`
};