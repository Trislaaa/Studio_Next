import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { chatConfig } from './config';
import { getEmbeddingClient } from './llm-client';

export type VectorKnowledgeMatch = {
  title: string;
  category: string;
  source: string | null;
  chunkText: string;
  distance: number;
};

function toVectorLiteral(values: number[]) {
  const safeValues = values.map((value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value.toFixed(8));
  });

  return `[${safeValues.join(',')}]`;
}

function isVectorMissingError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('column') && message.includes('embedding')
  ) || message.includes('type "vector" does not exist');
}

export async function retrieveKnowledgeByVector(query: string, limit = 4): Promise<VectorKnowledgeMatch[]> {
  const embeddingClient = getEmbeddingClient();

  if (!embeddingClient) {
    return [];
  }

  try {
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: chatConfig.embeddingModel,
      input: query,
    });

    const embedding = embeddingResponse.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      return [];
    }

    const vectorLiteral = toVectorLiteral(embedding);

    const rows = await prisma.$queryRaw<VectorKnowledgeMatch[]>(Prisma.sql`
      SELECT
        kd.title,
        kd.category,
        kd.source,
        kc.chunk_text AS "chunkText",
        (kc.embedding <=> ${vectorLiteral}::vector) AS distance
      FROM knowledge_chunks kc
      INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.is_active = true
        AND kc.embedding IS NOT NULL
      ORDER BY kc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);

    return rows;
  } catch (error) {
    if (!isVectorMissingError(error)) {
      console.error('Vector retrieval error:', error);
    }

    return [];
  }
}
