import { JGrantsApiClient } from '../app/services/subsidies/api-server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Add delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FetchState {
  subsidies: any[];
  details: any[];
  failedIds: string[];
  lastProcessedIndex: number;
}

async function loadState(statePath: string): Promise<FetchState | null> {
  if (existsSync(statePath)) {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
}

async function saveState(statePath: string, state: FetchState) {
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

async function main() {
  
  const client = new JGrantsApiClient();
  const outputDir = join(process.cwd(), 'data', 'api-responses');
  const statePath = join(outputDir, 'fetch-state.json');
  
  try {
    // Create output directory if it doesn't exist
    await mkdir(outputDir, { recursive: true });
    
    // Load previous state if exists
    let state = await loadState(statePath);
    
    if (!state) {
      // First run - fetch subsidies list
      const subsidies = await client.fetchTokyoSubsidies();
      
      // Save subsidies list
      const subsidiesPath = join(outputDir, 'tokyo-subsidies-list.json');
      await writeFile(subsidiesPath, JSON.stringify(subsidies, null, 2));
      
      state = {
        subsidies,
        details: [],
        failedIds: [],
        lastProcessedIndex: -1
      };
      await saveState(statePath, state);
    } else {
    }
    
    // Fetch details with rate limiting
    const delayMs = 2000; // 2 seconds between requests
    
    for (let i = state.lastProcessedIndex + 1; i < state.subsidies.length; i++) {
      const subsidy = state.subsidies[i];
      
      try {
        const detail = await client.fetchSubsidyDetail(subsidy.id);
        if (detail) {
          state.details.push(detail);
        } else {
          state.failedIds.push(subsidy.id);
        }
      } catch (error) {
        state.failedIds.push(subsidy.id);
      }
      
      state.lastProcessedIndex = i;
      
      // Save state every 5 subsidies
      if (i % 5 === 0) {
        await saveState(statePath, state);
      }
      
      // Rate limiting delay
      if (i < state.subsidies.length - 1) {
        await delay(delayMs);
      }
    }
    
    // Save final state
    await saveState(statePath, state);
    
    // Save all subsidy details
    const detailsPath = join(outputDir, 'tokyo-subsidies-details-complete.json');
    await writeFile(detailsPath, JSON.stringify(state.details, null, 2));
    
    // Create final summary
    const summary = {
      fetchedAt: new Date().toISOString(),
      totalSubsidies: state.subsidies.length,
      detailsFetched: state.details.length,
      failedCount: state.failedIds.length,
      failedIds: state.failedIds,
      subsidySummary: state.subsidies.map(s => ({
        id: s.id,
        name: s.name,
        title: s.title,
        maxLimit: s.subsidy_max_limit,
        acceptanceEnd: s.acceptance_end_datetime,
        detailFetched: state.details.some(d => d.id === s.id)
      }))
    };
    
    const summaryPath = join(outputDir, 'fetch-summary-complete.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    
    // Clean up state file
    if (state.details.length + state.failedIds.length === state.subsidies.length) {
      await writeFile(statePath + '.completed', JSON.stringify(state, null, 2));
      if (existsSync(statePath)) {
        const { unlink } = await import('fs/promises');
        await unlink(statePath);
      }
    }
    
  } catch (error) {
    console.error('Error fetching subsidies:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}