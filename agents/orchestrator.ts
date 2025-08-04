import type { AgentConfig, AgentTask, AgentType, AgentResponse } from './types';
import { frontendAgentConfig } from './frontend/config';
import { backendAgentConfig } from './backend/config';
import { dataAgentConfig } from './data/config';
import { testingAgentConfig } from './testing/config';
import { documentationAgentConfig } from './documentation/config';

export class AgentOrchestrator {
  private agents: Map<AgentType, AgentConfig>;
  private taskQueue: AgentTask[] = [];
  private activeAgents: Set<string> = new Set();

  constructor() {
    this.agents = new Map([
      ['frontend', frontendAgentConfig],
      ['backend', backendAgentConfig],
      ['data', dataAgentConfig],
      ['testing', testingAgentConfig],
      ['documentation', documentationAgentConfig],
    ]);
  }

  /**
   * Route a task to the appropriate agent based on the task description
   */
  async routeTask(taskDescription: string): Promise<AgentType> {
    const lowerDescription = taskDescription.toLowerCase();
    
    // Simple keyword-based routing (can be enhanced with AI)
    if (lowerDescription.includes('ui') || 
        lowerDescription.includes('component') || 
        lowerDescription.includes('frontend') ||
        lowerDescription.includes('tailwind') ||
        lowerDescription.includes('react')) {
      return 'frontend';
    }
    
    if (lowerDescription.includes('api') || 
        lowerDescription.includes('server') || 
        lowerDescription.includes('backend') ||
        lowerDescription.includes('database') ||
        lowerDescription.includes('openai')) {
      return 'backend';
    }
    
    if (lowerDescription.includes('data') || 
        lowerDescription.includes('subsidy') || 
        lowerDescription.includes('search') ||
        lowerDescription.includes('filter') ||
        lowerDescription.includes('json')) {
      return 'data';
    }
    
    if (lowerDescription.includes('test') || 
        lowerDescription.includes('quality') || 
        lowerDescription.includes('coverage') ||
        lowerDescription.includes('ci') ||
        lowerDescription.includes('cd')) {
      return 'testing';
    }
    
    if (lowerDescription.includes('doc') || 
        lowerDescription.includes('readme') || 
        lowerDescription.includes('guide') ||
        lowerDescription.includes('tutorial')) {
      return 'documentation';
    }
    
    // Default to backend for general tasks
    return 'backend';
  }

  /**
   * Create a new task and add it to the queue
   */
  async createTask(
    description: string, 
    priority: 'high' | 'medium' | 'low' = 'medium',
    agentType?: AgentType
  ): Promise<AgentTask> {
    const type = agentType || await this.routeTask(description);
    
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentType: type,
      description,
      priority,
      status: 'pending',
      input: { description },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.taskQueue.push(task);
    return task;
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskId: string): Promise<AgentResponse> {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      };
    }
    
    if (task.status !== 'pending') {
      return {
        success: false,
        error: `Task is already ${task.status}`,
      };
    }
    
    const agent = this.agents.get(task.agentType);
    if (!agent) {
      return {
        success: false,
        error: `Agent type ${task.agentType} not found`,
      };
    }
    
    try {
      task.status = 'in_progress';
      task.updatedAt = new Date();
      this.activeAgents.add(task.id);
      
      // Here you would integrate with the actual AI execution
      // For now, we'll simulate the response
      const result = await this.simulateAgentExecution(task, agent);
      
      task.status = 'completed';
      task.output = result;
      task.updatedAt = new Date();
      this.activeAgents.delete(task.id);
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.updatedAt = new Date();
      this.activeAgents.delete(task.id);
      
      return {
        success: false,
        error: task.error,
      };
    }
  }

  /**
   * Get the status of all tasks
   */
  getTaskStatus(): {
    pending: AgentTask[];
    inProgress: AgentTask[];
    completed: AgentTask[];
    failed: AgentTask[];
  } {
    return {
      pending: this.taskQueue.filter(t => t.status === 'pending'),
      inProgress: this.taskQueue.filter(t => t.status === 'in_progress'),
      completed: this.taskQueue.filter(t => t.status === 'completed'),
      failed: this.taskQueue.filter(t => t.status === 'failed'),
    };
  }

  /**
   * Get recommendations for next tasks based on completed work
   */
  async getRecommendations(): Promise<string[]> {
    const status = this.getTaskStatus();
    const recommendations: string[] = [];
    
    // Analyze completed tasks and suggest follow-ups
    for (const task of status.completed) {
      switch (task.agentType) {
        case 'frontend':
          recommendations.push('Create tests for the new UI components');
          recommendations.push('Update documentation for UI changes');
          break;
        case 'backend':
          recommendations.push('Add integration tests for new API endpoints');
          recommendations.push('Optimize database queries for performance');
          break;
        case 'data':
          recommendations.push('Validate the updated data structure');
          recommendations.push('Update search algorithms for new data fields');
          break;
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Coordinate multiple agents for complex tasks
   */
  async coordinateAgents(
    mainTask: string,
    subtasks: { agentType: AgentType; description: string }[]
  ): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
    
    // Create main task
    const main = await this.createTask(mainTask, 'high');
    
    // Create subtasks
    const subTaskIds = await Promise.all(
      subtasks.map(st => 
        this.createTask(st.description, 'medium', st.agentType)
      )
    );
    
    // Execute tasks in parallel where possible
    const executions = await Promise.all([
      this.executeTask(main.id),
      ...subTaskIds.map(t => this.executeTask(t.id))
    ]);
    
    return executions;
  }

  /**
   * Simulate agent execution (placeholder for actual AI integration)
   */
  private async simulateAgentExecution(
    task: AgentTask, 
    agent: AgentConfig
  ): Promise<any> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      agentName: agent.name,
      taskDescription: task.description,
      suggestions: [
        `Analyzed ${task.description}`,
        `Applied ${agent.name} expertise`,
        `Generated solution based on project context`,
      ],
      code: '// Generated code would appear here',
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const orchestrator = new AgentOrchestrator();