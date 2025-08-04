import type { AgentType, AgentTask } from '../types';

/**
 * Parse user input to extract agent mentions and tasks
 */
export function parseAgentMentions(input: string): {
  agents: AgentType[];
  tasks: string[];
} {
  const agents: AgentType[] = [];
  const tasks: string[] = [];
  
  const agentPatterns: Record<AgentType, RegExp> = {
    frontend: /(@frontend|@ui|@ux)/gi,
    backend: /(@backend|@api|@server)/gi,
    data: /(@data|@search|@subsidy)/gi,
    testing: /(@test|@testing|@quality)/gi,
    documentation: /(@doc|@docs|@documentation)/gi,
  };
  
  // Extract agent mentions
  for (const [agent, pattern] of Object.entries(agentPatterns)) {
    if (pattern.test(input)) {
      agents.push(agent as AgentType);
    }
  }
  
  // Extract tasks (lines starting with - or *)
  const taskPattern = /^[\-\*]\s+(.+)$/gm;
  let match;
  while ((match = taskPattern.exec(input)) !== null) {
    tasks.push(match[1].trim());
  }
  
  return { agents, tasks };
}

/**
 * Format task results for display
 */
export function formatTaskResults(tasks: AgentTask[]): string {
  const grouped = tasks.reduce((acc, task) => {
    if (!acc[task.agentType]) {
      acc[task.agentType] = [];
    }
    acc[task.agentType].push(task);
    return acc;
  }, {} as Record<AgentType, AgentTask[]>);
  
  let output = '## Task Results\n\n';
  
  for (const [agent, agentTasks] of Object.entries(grouped)) {
    output += `### ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent\n\n`;
    
    for (const task of agentTasks) {
      const status = task.status === 'completed' ? '✅' : 
                    task.status === 'failed' ? '❌' : 
                    task.status === 'in_progress' ? '🔄' : '⏳';
      
      output += `${status} **${task.description}**\n`;
      if (task.output) {
        output += `   Result: ${JSON.stringify(task.output, null, 2)}\n`;
      }
      if (task.error) {
        output += `   Error: ${task.error}\n`;
      }
      output += '\n';
    }
  }
  
  return output;
}

/**
 * Analyze code changes to suggest relevant agents
 */
export function suggestAgentsForChanges(changedFiles: string[]): AgentType[] {
  const suggestions = new Set<AgentType>();
  
  for (const file of changedFiles) {
    if (file.includes('components/') || file.includes('routes/') || file.endsWith('.tsx')) {
      suggestions.add('frontend');
      suggestions.add('testing'); // UI changes need tests
    }
    
    if (file.includes('services/') || file.includes('api.') || file.endsWith('.server.ts')) {
      suggestions.add('backend');
      suggestions.add('testing'); // API changes need tests
    }
    
    if (file.includes('data/') || file.includes('subsid') || file.includes('filter')) {
      suggestions.add('data');
    }
    
    if (file.endsWith('.md') || file.includes('README')) {
      suggestions.add('documentation');
    }
    
    if (file.includes('.test.') || file.includes('.spec.')) {
      suggestions.add('testing');
    }
  }
  
  return Array.from(suggestions);
}

/**
 * Generate task dependencies based on task descriptions
 */
export function analyzeDependencies(tasks: AgentTask[]): Map<string, string[]> {
  const dependencies = new Map<string, string[]>();
  
  // Simple keyword-based dependency detection
  for (const task of tasks) {
    const deps: string[] = [];
    const lowerDesc = task.description.toLowerCase();
    
    // Frontend tasks often depend on backend APIs
    if (task.agentType === 'frontend' && lowerDesc.includes('api')) {
      const apiTask = tasks.find(t => 
        t.agentType === 'backend' && 
        t.description.toLowerCase().includes('api')
      );
      if (apiTask) deps.push(apiTask.id);
    }
    
    // Tests depend on implementation
    if (task.agentType === 'testing') {
      const implTasks = tasks.filter(t => 
        t.agentType !== 'testing' && 
        t.agentType !== 'documentation'
      );
      deps.push(...implTasks.map(t => t.id));
    }
    
    // Documentation depends on all implementation
    if (task.agentType === 'documentation') {
      const otherTasks = tasks.filter(t => t.agentType !== 'documentation');
      deps.push(...otherTasks.map(t => t.id));
    }
    
    if (deps.length > 0) {
      dependencies.set(task.id, deps);
    }
  }
  
  return dependencies;
}

/**
 * Estimate task complexity and time
 */
export function estimateTaskComplexity(description: string): {
  complexity: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
} {
  const lowerDesc = description.toLowerCase();
  
  // High complexity indicators
  if (lowerDesc.includes('refactor') || 
      lowerDesc.includes('optimize') || 
      lowerDesc.includes('architecture') ||
      lowerDesc.includes('migration')) {
    return { complexity: 'high', estimatedMinutes: 120 };
  }
  
  // Medium complexity indicators
  if (lowerDesc.includes('implement') || 
      lowerDesc.includes('create') || 
      lowerDesc.includes('enhance') ||
      lowerDesc.includes('integrate')) {
    return { complexity: 'medium', estimatedMinutes: 60 };
  }
  
  // Low complexity (default)
  return { complexity: 'low', estimatedMinutes: 30 };
}

/**
 * Generate agent collaboration suggestions
 */
export function suggestCollaboration(task: AgentTask): AgentType[] {
  const collaborators: AgentType[] = [];
  const lowerDesc = task.description.toLowerCase();
  
  switch (task.agentType) {
    case 'frontend':
      if (lowerDesc.includes('api') || lowerDesc.includes('data')) {
        collaborators.push('backend');
      }
      collaborators.push('testing');
      break;
      
    case 'backend':
      if (lowerDesc.includes('ui') || lowerDesc.includes('display')) {
        collaborators.push('frontend');
      }
      if (lowerDesc.includes('data') || lowerDesc.includes('subsidy')) {
        collaborators.push('data');
      }
      collaborators.push('testing');
      break;
      
    case 'data':
      collaborators.push('backend');
      collaborators.push('testing');
      break;
      
    case 'testing':
      // Testing agent works with everyone
      break;
      
    case 'documentation':
      // Documentation needs input from all agents
      collaborators.push('frontend', 'backend', 'data');
      break;
  }
  
  // Always update documentation for significant changes
  if (lowerDesc.includes('new') || lowerDesc.includes('major') || lowerDesc.includes('breaking')) {
    collaborators.push('documentation');
  }
  
  return [...new Set(collaborators)]; // Remove duplicates
}