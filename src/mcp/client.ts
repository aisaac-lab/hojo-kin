import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function main() {
  const transport = new StdioClientTransport({
    command: 'tsx',
    args: ['./src/mcp/server.ts'],
  });

  const client = new Client({
    name: 'subsidy-search-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  await client.connect(transport);

  try {
    const tools = await client.listTools();
    tools.tools.forEach((tool) => {
    });

    const searchResult = await client.callTool({
      name: 'search_subsidies',
      arguments: {
        query: 'IT導入に関する補助金を教えてください',
      },
    });
    if (searchResult.content && Array.isArray(searchResult.content) && searchResult.content.length > 0) {
    }

    const listResult = await client.callTool({
      name: 'list_subsidies',
      arguments: {
        limit: 5,
      },
    });
    if (listResult.content && Array.isArray(listResult.content) && listResult.content.length > 0) {
    }

    const resources = await client.listResources();
    resources.resources.forEach((resource) => {
    });

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await transport.close();
    process.exit(0);
  }
}

main().catch(console.error);