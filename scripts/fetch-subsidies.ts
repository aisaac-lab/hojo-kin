import { JGrantsApiClient } from '../app/services/subsidies/api-server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  
  const client = new JGrantsApiClient();
  const outputDir = join(process.cwd(), 'data', 'api-responses');
  
  try {
    // Create output directory if it doesn't exist
    await mkdir(outputDir, { recursive: true });
    
    // Fetch Tokyo subsidies list
    const subsidies = await client.fetchTokyoSubsidies();
    
    // Save subsidies list
    const subsidiesPath = join(outputDir, 'tokyo-subsidies-list.json');
    await writeFile(subsidiesPath, JSON.stringify(subsidies, null, 2));
    
    // Fetch all subsidy details
    const subsidyDetails = await client.fetchAllTokyoSubsidyDetails();
    
    // Save all subsidy details
    const detailsPath = join(outputDir, 'tokyo-subsidies-details.json');
    await writeFile(detailsPath, JSON.stringify(subsidyDetails, null, 2));
    
    // Create a summary file
    const summary = {
      fetchedAt: new Date().toISOString(),
      totalSubsidies: subsidies.length,
      detailsFetched: subsidyDetails.length,
      subsidySummary: subsidies.map(s => ({
        id: s.id,
        name: s.name,
        title: s.title,
        maxLimit: s.subsidy_max_limit,
        acceptanceEnd: s.acceptance_end_datetime,
      }))
    };
    
    const summaryPath = join(outputDir, 'fetch-summary.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    
  } catch (error) {
    console.error('Error fetching subsidies:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}