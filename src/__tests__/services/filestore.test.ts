import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStoreService } from '../../../app/services/filestore.server';
import { prisma } from '../../../app/db';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import type { Subsidy } from '../../../app/db/schema';

describe('FileStoreService', () => {
  let fileStoreService: FileStoreService;
  let testSubsidy: Subsidy | null;

  beforeEach(async () => {
    fileStoreService = new FileStoreService();
    
    testSubsidy = await prisma.subsidy.create({
      data: {
        jgrantsId: 'TEST-001',
        title: 'テスト補助金',
        description: 'これはテスト用の補助金です',
        targetAudience: '中小企業',
        amount: '最大100万円',
        deadline: '2024年12月31日',
        requirements: 'テスト要件',
        applicationUrl: 'https://example.com',
        ministry: 'テスト省',
      },
    });
  });

  afterEach(async () => {
    if (testSubsidy) {
      try {
        const filePath = join(process.cwd(), 'data', 'subsidies', `${testSubsidy.jgrantsId}.md`);
        await unlink(filePath);
      } catch (error) {
        // ファイルが存在しない場合は無視
      }
    }
  });

  describe('saveSubsidyAsMarkdown', () => {
    it('should save subsidy as markdown file', async () => {
      if (!testSubsidy) throw new Error('Test subsidy not created');
      const { filePath, fileName } = await fileStoreService.saveSubsidyAsMarkdown(testSubsidy);

      expect(fileName).toBe('TEST-001.md');
      expect(filePath).toContain('data/subsidies/TEST-001.md');

      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('# テスト補助金');
      expect(content).toContain('## 概要');
      expect(content).toContain('これはテスト用の補助金です');
      expect(content).toContain('## 対象者');
      expect(content).toContain('中小企業');
      expect(content).toContain('## 補助金額');
      expect(content).toContain('最大100万円');
    });
  });

  describe('readSubsidyMarkdown', () => {
    it('should read markdown file', async () => {
      if (!testSubsidy) throw new Error('Test subsidy not created');
      await fileStoreService.saveSubsidyAsMarkdown(testSubsidy);
      
      const content = await fileStoreService.readSubsidyMarkdown('TEST-001');
      
      expect(content).not.toBeNull();
      expect(content).toContain('# テスト補助金');
    });

    it('should return null for non-existent file', async () => {
      const content = await fileStoreService.readSubsidyMarkdown('NON-EXISTENT');
      
      expect(content).toBeNull();
    });
  });

  describe('getAllSubsidyFiles', () => {
    it('should return all subsidy files', async () => {
      if (!testSubsidy) throw new Error('Test subsidy not created');
      await fileStoreService.saveSubsidyAsMarkdown(testSubsidy);
      
      const files = await fileStoreService.getAllSubsidyFiles();
      
      expect(files).toHaveLength(1);
      expect(files[0]).toHaveProperty('name', 'TEST-001.md');
      expect(files[0]).toHaveProperty('jgrantsId', 'TEST-001');
      expect(files[0]).toHaveProperty('subsidyId', testSubsidy!.id);
    });
  });

  describe('createFileForOpenAI', () => {
    it('should create File object for OpenAI', async () => {
      if (!testSubsidy) throw new Error('Test subsidy not created');
      const file = await fileStoreService.createFileForOpenAI(testSubsidy.id.toString());
      
      expect(file).not.toBeNull();
      expect(file?.name).toBe('TEST-001.md');
      expect(file?.type).toBe('text/markdown');
    });

    it('should return null for non-existent subsidy', async () => {
      const file = await fileStoreService.createFileForOpenAI('non-existent-id');
      
      expect(file).toBeNull();
    });
  });

  describe('batchCreateFiles', () => {
    it('should create multiple files', async () => {
      const subsidy2 = await prisma.subsidy.create({
        data: {
          jgrantsId: 'TEST-002',
          title: 'テスト補助金2',
          description: 'これは2つ目のテスト補助金です',
        },
      });

      if (!testSubsidy) throw new Error('Test subsidy not created');
      const files = await fileStoreService.batchCreateFiles([
        testSubsidy.id.toString(),
        subsidy2.id.toString(),
      ]);
      
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('TEST-001.md');
      expect(files[1].name).toBe('TEST-002.md');
    });
  });
});