export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  fileAccess: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface AgentTask {
  id: string;
  agentType: AgentType;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input: any;
  output?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType = 
  | 'frontend'
  | 'backend'
  | 'data'
  | 'testing'
  | 'documentation';

export interface AgentResponse {
  success: boolean;
  result?: any;
  error?: string;
  suggestions?: string[];
}