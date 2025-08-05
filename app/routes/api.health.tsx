import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { threadRepository } from '~/utils/database-simple';

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		// Check database connection
		const dbCheck = await checkDatabase();
		
		// Check OpenAI configuration
		const openAICheck = checkOpenAIConfig();
		
		const status = dbCheck.healthy && openAICheck.healthy ? 'healthy' : 'unhealthy';
		const httpStatus = status === 'healthy' ? 200 : 503;
		
		return json(
			{
				status,
				timestamp: new Date().toISOString(),
				checks: {
					database: dbCheck,
					openai: openAICheck,
				},
			},
			{ status: httpStatus }
		);
	} catch (error) {
		console.error('[Health Check] Error:', error);
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 503 }
		);
	}
}

async function checkDatabase(): Promise<{ healthy: boolean; message: string }> {
	try {
		// Try a simple query to test database connection
		const result = await threadRepository.findMany('health-check');
		if ('ok' in result && !result.ok) {
			throw new Error(result.error.message);
		}
		return {
			healthy: true,
			message: 'Database connection successful',
		};
	} catch (error) {
		return {
			healthy: false,
			message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
		};
	}
}

function checkOpenAIConfig(): { healthy: boolean; message: string } {
	const apiKey = process.env.OPENAI_API_KEY;
	const assistantId = process.env.OPENAI_ASSISTANT_ID;
	
	if (!apiKey || !assistantId) {
		return {
			healthy: false,
			message: 'Missing OpenAI configuration',
		};
	}
	
	return {
		healthy: true,
		message: 'OpenAI configuration present',
	};
}