import { db } from '../app/db.server';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { resolve, join } from 'path';
import { FileStoreService } from '../app/services/filestore.server';
import fs from 'fs/promises';
import { readdir } from 'fs/promises';

dotenv.config({ path: resolve(process.cwd(), '.env') });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const fileStoreService = new FileStoreService();

interface SubsidyData {
  jgrantsId: string;
  title: string;
  description: string;
  targetAudience?: string;
  amount?: string;
  deadline?: string;
  requirements?: string;
  applicationUrl?: string;
  ministry?: string;
}

const sampleSubsidies: SubsidyData[] = [
  {
    jgrantsId: 'IT-001',
    title: 'IT導入補助金2024',
    description: '中小企業・小規模事業者等が自社の課題やニーズに合ったITツールを導入する経費の一部を補助することで、業務効率化・売上アップをサポートする補助金です。',
    targetAudience: '中小企業、小規模事業者',
    amount: '最大450万円（補助率1/2〜3/4）',
    deadline: '2024年12月31日',
    requirements: '・日本国内で事業を行う中小企業・小規模事業者であること\n・IT導入支援事業者が提供するITツールを導入すること',
    applicationUrl: 'https://example.com/it-subsidy',
    ministry: '経済産業省',
  },
  {
    jgrantsId: 'MONO-001',
    title: 'ものづくり補助金',
    description: '中小企業・小規模事業者等が取り組む革新的サービス開発・試作品開発・生産プロセスの改善を行うための設備投資等を支援する補助金です。',
    targetAudience: '中小企業、小規模事業者',
    amount: '最大1,250万円（補助率1/2〜2/3）',
    deadline: '2024年11月30日',
    requirements: '・3〜5年の事業計画を策定し、従業員に表明していること\n・事業計画期間において、給与支給総額を年率平均1.5%以上増加',
    applicationUrl: 'https://example.com/monozukuri',
    ministry: '中小企業庁',
  },
  {
    jgrantsId: 'STARTUP-001',
    title: '創業支援補助金',
    description: '新たに創業する者に対して、創業に要する経費の一部を補助する制度です。地域の開業率を引き上げ、雇用を生み出し、産業の新陳代謝を促進することを目的としています。',
    targetAudience: '創業予定者、創業後5年以内の事業者',
    amount: '最大200万円（補助率1/2）',
    deadline: '2024年10月31日',
    requirements: '・新たに創業する者であること\n・事業計画書を提出すること\n・地域の商工会議所等の支援を受けること',
    applicationUrl: 'https://example.com/startup',
    ministry: '中小企業庁',
  },
];

async function syncExistingMarkdownFiles(vectorStoreId: string) {
  const subsidiesDir = join(process.cwd(), 'data', 'subsidies');
  
  try {
    const files = await readdir(subsidiesDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    
    for (const fileName of markdownFiles) {
      const filePath = join(subsidiesDir, fileName);
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const file = new File([fileContent], fileName, {
        type: 'text/markdown',
      });
      
      const openaiFile = await openai.files.create({
        file: file,
        purpose: 'assistants',
      });
      
      await openai.vectorStores.files.create(vectorStoreId, {
        file_id: openaiFile.id,
      });
      
    }
    
    return markdownFiles.length;
  } catch (error) {
    console.error('Error syncing existing markdown files:', error);
    return 0;
  }
}

async function syncApiResponseFiles(vectorStoreId: string) {
  const apiResponsesDir = join(process.cwd(), 'data', 'api-responses');
  
  try {
    const files = await readdir(apiResponsesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    
    for (const fileName of jsonFiles) {
      const filePath = join(apiResponsesDir, fileName);
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse and format JSON for better searchability
      const jsonData = JSON.parse(fileContent);
      let formattedContent = `# ${fileName}\n\n`;
      
      if (Array.isArray(jsonData)) {
        formattedContent += `## 補助金リスト (${jsonData.length}件)\n\n`;
        jsonData.forEach((item, index) => {
          formattedContent += `### ${index + 1}. ${item.title || item.name}\n`;
          formattedContent += `- ID: ${item.id}\n`;
          formattedContent += `- 対象地域: ${item.target_area_search || 'N/A'}\n`;
          formattedContent += `- 最大補助額: ${item.subsidy_max_limit ? `¥${item.subsidy_max_limit.toLocaleString()}` : 'N/A'}\n`;
          formattedContent += `- 受付期間: ${item.acceptance_start_datetime} 〜 ${item.acceptance_end_datetime}\n`;
          formattedContent += `- 従業員数: ${item.target_number_of_employees || 'N/A'}\n\n`;
        });
      } else {
        formattedContent += JSON.stringify(jsonData, null, 2);
      }
      
      const file = new File([formattedContent], fileName.replace('.json', '.md'), {
        type: 'text/markdown',
      });
      
      const openaiFile = await openai.files.create({
        file: file,
        purpose: 'assistants',
      });
      
      await openai.vectorStores.files.create(vectorStoreId, {
        file_id: openaiFile.id,
      });
      
    }
    
    return jsonFiles.length;
  } catch (error) {
    console.error('Error syncing API response files:', error);
    return 0;
  }
}

async function syncSubsidies() {
  try {

    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    if (!vectorStoreId) {
      throw new Error('OPENAI_VECTOR_STORE_ID not found in environment variables');
    }

    // Sync sample subsidies to database and create markdown files
    for (const subsidyData of sampleSubsidies) {

      const subsidy = await db.subsidy.upsert({
        where: { jgrantsId: subsidyData.jgrantsId },
        update: subsidyData,
        create: subsidyData,
      });


      const { filePath } = await fileStoreService.saveSubsidyAsMarkdown(subsidy);
    }

    // Sync all existing markdown files from data/subsidies
    const markdownCount = await syncExistingMarkdownFiles(vectorStoreId);
    
    // Sync JSON files from data/api-responses
    const jsonCount = await syncApiResponseFiles(vectorStoreId);

  } catch (error) {
    console.error('Error syncing subsidies:', error);
    throw error;
  } finally {
    // Database connection is managed by the db module
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncSubsidies()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { syncSubsidies };