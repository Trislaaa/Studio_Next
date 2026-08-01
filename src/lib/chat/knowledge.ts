import { prisma } from '@/lib/db';
import { BROCHURE_KNOWLEDGE_CONTEXT } from './brochure-context';
import { retrieveKnowledgeByVector } from './retrieval';

type KnowledgeDocumentWithChunks = {
  title: string;
  category: string;
  source: string | null;
  content: string;
  updatedAt: Date;
  chunks: { chunkText: string; chunkIndex: number }[];
};

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);
}

function scoreText(text: string, words: string[]) {
  const haystack = text.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export async function buildKnowledgeContext(query: string, limit = 3) {
  const words = normalizeWords(query);
  const sections: string[] = [];

  sections.push(BROCHURE_KNOWLEDGE_CONTEXT);

  if (words.length === 0) {
    return sections.join('\n\n');
  }

  const vectorMatches = await retrieveKnowledgeByVector(query, limit);
  const vectorContext = vectorMatches
    .map((entry) => {
      return [
        `Title: ${entry.title}`,
        `Category: ${entry.category}`,
        entry.source ? `Source: ${entry.source}` : null,
        `Distance: ${entry.distance.toFixed(4)}`,
        `Context: ${truncateText(entry.chunkText, 1800)}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');

  if (vectorContext) {
    return [sections.join('\n\n'), vectorContext].filter(Boolean).join('\n\n===\n\n');
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    take: 25,
    include: {
      chunks: {
        orderBy: { chunkIndex: 'asc' },
        take: 8,
        select: {
          chunkText: true,
          chunkIndex: true,
        },
      },
    },
  });

  const scoredDocuments = (documents as KnowledgeDocumentWithChunks[])
    .map((document) => {
      const chunkText = document.chunks.map((chunk) => chunk.chunkText).join('\n');
      const contentToScore = `${document.title}\n${document.category}\n${chunkText || document.content}`;

      return {
        document,
        score: scoreText(contentToScore, words),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const documentContext = scoredDocuments
    .map(({ document, score }) => {
      const chunkText = document.chunks.map((chunk) => chunk.chunkText).join('\n');
      const summarySource = chunkText || document.content;

      return [
        `Title: ${document.title}`,
        `Category: ${document.category}`,
        `Score: ${score}`,
        document.source ? `Source: ${document.source}` : null,
        `Context: ${truncateText(summarySource, 1800)}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');

  return [sections.join('\n\n'), documentContext].filter(Boolean).join('\n\n===\n\n');
}

export function detectChatIntent(message: string) {
  const text = message.toLowerCase();

  if (/brochure|catalog|product|machine|software|cad|cam|garment|plotter|spreader|cutter|digitiz|address|contact|phone|email|location|training|service|experience|mumbai|andheri|price|nest|getonagain|supernest|denim|cyg yin|cam solution|sample cutter|cad hardware|cad software|magic inkjet|sn-mj|h185|h185-4|xh|goa-sp|hp45|flatbed|inkjet cutting|vertical cutter|inspection|tf-100|tf-260|ys-160|ys-190|ys-210|ys-hx|ys-1818|ys-2018|ys-2517|ys-3323|b4 series|b4-1518c|pa-ssd|pvc conveyor|fabric spreading|fabric cutting|multi-ply|single-ply|auto fabric|photo digitizing|ipen|grading|marker|pds|digitizer board|ga-d3648c|ga-d4460c|richpeace|job work|design studio|sampling|pattern making|cutting room|oscillating|knife sharpener/i.test(text)) {
    return 'studionext_info';
  }

  return 'studionext_general';
}
