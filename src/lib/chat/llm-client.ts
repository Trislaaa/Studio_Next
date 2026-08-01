import OpenAI from 'openai';
import { chatConfig } from './config';

let chatClient: OpenAI | null = null;
let embeddingClient: OpenAI | null = null;

function createClient(apiKey: string, baseURL?: string) {
  return new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey });
}

export function getChatClient() {
  if (chatConfig.provider === 'groq') {
    if (!chatConfig.groqApiKey) {
      return null;
    }

    if (!chatClient) {
      chatClient = createClient(chatConfig.groqApiKey, chatConfig.groqBaseUrl);
    }

    return chatClient;
  }

  if (!chatConfig.openAiApiKey) {
    return null;
  }

  if (!chatClient) {
    chatClient = createClient(chatConfig.openAiApiKey);
  }

  return chatClient;
}

export function getEmbeddingClient() {
  if (chatConfig.embeddingProvider !== 'openai') {
    return null;
  }

  const apiKey = chatConfig.embeddingApiKey ?? chatConfig.openAiApiKey;
  if (!apiKey) {
    return null;
  }

  if (!embeddingClient) {
    embeddingClient = createClient(apiKey, chatConfig.embeddingBaseUrl);
  }

  return embeddingClient;
}
