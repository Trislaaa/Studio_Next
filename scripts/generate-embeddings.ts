import OpenAI from 'openai';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { chatConfig } from '../src/lib/chat/config';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL must be configured');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as PrismaClient & {
  knowledgeDocument: Prisma.KnowledgeDocumentDelegate;
  knowledgeChunk: Prisma.KnowledgeChunkDelegate;
};

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

function chunkText(content: string, maxChars = 1800, overlapChars = 240) {
  const normalized = content.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + maxChars, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}

function toVectorLiteral(values: number[]) {
  const safeValues = values.map((value) => Number(value.toFixed(8)));
  return `[${safeValues.join(',')}]`;
}

async function ensureVectorSupport(dimension: number) {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(${dimension})`
  );

  try {
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)'
    );
  } catch (error) {
    console.warn('Embedding index creation skipped:', error);
  }
}

async function main() {
  const embeddingProvider = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();
  if (embeddingProvider !== 'openai') {
    throw new Error('Only openai-compatible embedding providers are supported in this script');
  }

  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY or OPENAI_API_KEY is required to generate embeddings');
  }

  const embeddingBaseUrl = process.env.EMBEDDING_BASE_URL;
  const openai = new OpenAI(embeddingBaseUrl ? { apiKey, baseURL: embeddingBaseUrl } : { apiKey });

  console.log('Preparing vector support...');
  await ensureVectorSupport(chatConfig.embeddingDimension);

  const documents = await prisma.knowledgeDocument.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`Generating embeddings for ${documents.length} documents...`);

  for (const document of documents) {
    const chunks = chunkText(document.content);

    await prisma.knowledgeChunk.deleteMany({
      where: { documentId: document.id },
    });

    console.log(`Document: ${document.title} | chunks: ${chunks.length}`);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];

      const embeddingResponse = await openai.embeddings.create({
        model: chatConfig.embeddingModel,
        input: chunk,
      });

      const embedding = embeddingResponse.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        continue;
      }

      const createdChunk = await prisma.knowledgeChunk.create({
        data: {
          documentId: document.id,
          chunkIndex: index,
          chunkText: chunk,
          tokenCount: estimateTokenCount(chunk),
          embeddingModel: chatConfig.embeddingModel,
          metadata: {
            source: document.source,
            category: document.category,
            title: document.title,
          },
          embeddedAt: new Date(),
        },
      });

      const vectorLiteral = toVectorLiteral(embedding);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "knowledge_chunks"
        SET "embedding" = ${vectorLiteral}::vector,
            "embedding_model" = ${chatConfig.embeddingModel},
            "embedded_at" = NOW()
        WHERE "id" = ${createdChunk.id}
      `);
    }
  }

  await prisma.$executeRawUnsafe('ANALYZE "knowledge_chunks"');
  console.log('Embedding generation completed.');
}

main()
  .catch((error) => {
    console.error('Embedding generation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
