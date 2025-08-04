export const testingPrompts = {
  unitTestCreation: `When creating unit tests:
1. Test one unit of functionality per test
2. Use descriptive test names (it('should...')
3. Follow AAA pattern (Arrange, Act, Assert)
4. Mock external dependencies
5. Test both success and failure cases
6. Include edge cases
7. Aim for high code coverage`,

  integrationTestCreation: `When creating integration tests:
1. Test component interactions
2. Use realistic test data
3. Test API endpoints thoroughly
4. Verify database operations
5. Test error propagation
6. Check response formats
7. Validate business logic flows`,

  e2eTestCreation: `When creating E2E tests:
1. Test complete user journeys
2. Use page object pattern
3. Test critical paths first
4. Include accessibility checks
5. Test responsive behavior
6. Verify data persistence
7. Test error recovery`,

  testDataManagement: `When managing test data:
1. Create realistic test fixtures
2. Use factories for complex objects
3. Implement data cleanup
4. Avoid test interdependencies
5. Use deterministic data
6. Create edge case datasets
7. Version control test data`,

  cicdConfiguration: `When configuring CI/CD:
1. Set up automated test runs
2. Configure parallel test execution
3. Implement test result reporting
4. Set coverage thresholds
5. Add performance benchmarks
6. Configure deployment gates
7. Set up notification systems`,

  performanceTesting: `When testing performance:
1. Measure response times
2. Test concurrent user loads
3. Monitor memory usage
4. Check database query performance
5. Test API rate limits
6. Measure frontend rendering
7. Create performance baselines`,

  subsidyAppSpecific: `For subsidy app testing:
1. Test search accuracy and relevance
2. Verify filter combinations
3. Test OpenAI API integration
4. Validate subsidy data integrity
5. Test review agent decisions
6. Check auto-filter accuracy
7. Test chat conversation flows`
};