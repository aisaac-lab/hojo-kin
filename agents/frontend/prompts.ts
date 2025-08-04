export const frontendPrompts = {
  componentCreation: `When creating a new React component:
1. Use TypeScript with proper type definitions
2. Follow the existing component structure in the project
3. Use Tailwind CSS for styling
4. Ensure the component is responsive
5. Add proper loading and error states
6. Include accessibility attributes (aria-labels, roles, etc.)
7. Export the component with a clear, descriptive name`,

  uiEnhancement: `When enhancing UI/UX:
1. Analyze the current user flow
2. Identify pain points and areas for improvement
3. Propose solutions that align with the project's design system
4. Consider mobile and desktop experiences
5. Add micro-interactions where appropriate
6. Ensure smooth transitions and animations`,

  performanceOptimization: `When optimizing frontend performance:
1. Use React.memo for expensive components
2. Implement proper lazy loading
3. Optimize images and assets
4. Minimize bundle size
5. Use proper caching strategies
6. Implement code splitting where beneficial`,

  accessibilityImprovement: `When improving accessibility:
1. Ensure proper semantic HTML
2. Add ARIA labels and descriptions
3. Implement keyboard navigation
4. Ensure sufficient color contrast
5. Add focus indicators
6. Test with screen readers`,

  chatInterfaceSpecific: `For the chat interface:
1. Ensure smooth message scrolling
2. Add typing indicators
3. Implement message animations
4. Handle long messages gracefully
5. Add copy/share functionality for messages
6. Ensure proper message formatting (markdown support)`,

  filterPanelSpecific: `For filter panels:
1. Make filters intuitive and easy to use
2. Add clear visual feedback for active filters
3. Implement filter chips for selected options
4. Add clear all/reset functionality
5. Ensure filters are accessible via keyboard
6. Add smooth expand/collapse animations`
};