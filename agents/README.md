# Subsidy Search App - Development Agents

This directory contains specialized AI agents designed to assist with different aspects of the subsidy-search-app development.

## Agent Types

### 1. Frontend UI/UX Agent
- **Purpose**: Handle all frontend development tasks
- **Expertise**: React, TypeScript, Tailwind CSS, Remix
- **Location**: `agents/frontend/`

### 2. Backend API Agent
- **Purpose**: Focus on backend services and API development
- **Expertise**: Node.js, TypeScript, OpenAI API, Database operations
- **Location**: `agents/backend/`

### 3. Data Management Agent
- **Purpose**: Handle subsidy data processing and management
- **Expertise**: Data validation, search optimization, auto-filtering
- **Location**: `agents/data/`

### 4. Testing & Quality Agent
- **Purpose**: Ensure code quality and testing
- **Expertise**: Unit testing, integration testing, E2E testing, CI/CD
- **Location**: `agents/testing/`

### 5. Documentation Agent
- **Purpose**: Maintain project documentation
- **Expertise**: Technical writing, API docs, user guides
- **Location**: `agents/documentation/`

## Usage

### Basic Usage

```typescript
import { orchestrator } from './agents';

// Create a task
const task = await orchestrator.createTask(
  'Add a loading spinner to the chat interface',
  'high'
);

// Execute the task
const result = await orchestrator.executeTask(task.id);
```

### Task Routing

The orchestrator automatically routes tasks to the appropriate agent based on keywords:

```typescript
// This will be routed to the frontend agent
await orchestrator.createTask('Update the ChatInterface component');

// This will be routed to the backend agent
await orchestrator.createTask('Optimize the OpenAI API calls');

// This will be routed to the data agent
await orchestrator.createTask('Add new subsidy categories to the filter');
```

### Coordinated Tasks

For complex tasks requiring multiple agents:

```typescript
await orchestrator.coordinateAgents(
  'Implement user authentication',
  [
    { agentType: 'backend', description: 'Create auth API endpoints' },
    { agentType: 'frontend', description: 'Build login/signup forms' },
    { agentType: 'testing', description: 'Write auth integration tests' },
    { agentType: 'documentation', description: 'Document auth flow' }
  ]
);
```

## Agent Configuration

Each agent has:
- **System Prompt**: Defines the agent's role and expertise
- **Capabilities**: List of what the agent can do
- **File Access**: Patterns for files the agent can modify
- **Temperature**: Controls creativity vs. consistency

## Utility Functions

The `shared/utils.ts` file provides helpful utilities:

- `parseAgentMentions()`: Extract agent mentions from text
- `formatTaskResults()`: Format task results for display
- `suggestAgentsForChanges()`: Suggest agents based on file changes
- `analyzeDependencies()`: Analyze task dependencies
- `estimateTaskComplexity()`: Estimate task complexity and time
- `suggestCollaboration()`: Suggest agent collaboration

## Integration with Your Workflow

1. **VSCode Integration**: Use the agents through custom commands
2. **CLI Usage**: Create a CLI tool to interact with agents
3. **GitHub Actions**: Automate agent tasks in CI/CD
4. **Chat Interface**: Integrate agents into the app's chat

## Best Practices

1. **Task Descriptions**: Be specific and clear in task descriptions
2. **Priority Levels**: Use appropriate priority levels (high/medium/low)
3. **Agent Selection**: Let the orchestrator route tasks automatically
4. **Collaboration**: Use coordinated tasks for complex features
5. **Review Results**: Always review agent-generated code

## Future Enhancements

- [ ] AI-powered task routing
- [ ] Real-time collaboration between agents
- [ ] Learning from code reviews
- [ ] Custom agent creation
- [ ] Integration with IDE plugins