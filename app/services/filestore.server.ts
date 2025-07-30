import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { db } from '~/db';
import type { Subsidy } from '~/db/schema';

export class FileStoreService {
  private dataDir: string;

  constructor() {
    this.dataDir = join(process.cwd(), 'data', 'subsidies');
  }

  async ensureDataDirectory() {
    try {
      await mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async saveSubsidyAsMarkdown(subsidy: Subsidy) {
    await this.ensureDataDirectory();
    
    const content = this.generateMarkdownContent(subsidy);
    const fileName = `${subsidy.jgrantsId}.md`;
    const filePath = join(this.dataDir, fileName);
    
    await writeFile(filePath, content, 'utf-8');
    
    return { filePath, fileName };
  }

  async readSubsidyMarkdown(jgrantsId: string) {
    const fileName = `${jgrantsId}.md`;
    const filePath = join(this.dataDir, fileName);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Error reading markdown file:', error);
      return null;
    }
  }

  async getAllSubsidyFiles() {
    await this.ensureDataDirectory();
    
    const subsidies = await db.subsidy.findMany();
    const files = [];
    
    for (const subsidy of subsidies) {
      const fileName = `${subsidy.jgrantsId}.md`;
      const filePath = join(this.dataDir, fileName);
      
      files.push({
        path: filePath,
        name: fileName,
        subsidyId: subsidy.id,
        jgrantsId: subsidy.jgrantsId,
      });
    }
    
    return files;
  }

  private generateMarkdownContent(subsidy: Subsidy): string {
    const sections = [
      `# ${subsidy.title}`,
      '',
      '## 概要',
      subsidy.description,
      '',
    ];

    if (subsidy.targetAudience) {
      sections.push('## 対象者', subsidy.targetAudience, '');
    }

    if (subsidy.amount) {
      sections.push('## 補助金額', subsidy.amount, '');
    }

    if (subsidy.deadline) {
      sections.push('## 申請期限', subsidy.deadline, '');
    }

    if (subsidy.requirements) {
      sections.push('## 応募要件', subsidy.requirements, '');
    }

    if (subsidy.ministry) {
      sections.push('## 管轄省庁', subsidy.ministry, '');
    }

    if (subsidy.applicationUrl) {
      sections.push('## 申請URL', subsidy.applicationUrl, '');
    }

    sections.push(
      '',
      '---',
      '',
      '### メタデータ',
      `- ID: ${subsidy.jgrantsId}`,
      `- 更新日: ${subsidy.updatedAt.split('T')[0]}`,
    );

    return sections.join('\n');
  }

  async createFileForOpenAI(subsidyId: string): Promise<File | null> {
    const subsidy = await db.subsidy.findUnique({
      where: { id: subsidyId },
    });

    if (!subsidy) {
      return null;
    }

    const content = this.generateMarkdownContent(subsidy);
    const blob = new Blob([content], { type: 'text/markdown' });
    const file = new File([blob], `${subsidy.jgrantsId}.md`, { type: 'text/markdown' });

    return file;
  }

  async batchCreateFiles(subsidyIds: string[]): Promise<File[]> {
    const files: File[] = [];

    for (const id of subsidyIds) {
      const file = await this.createFileForOpenAI(id);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }
}