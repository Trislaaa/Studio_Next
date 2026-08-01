const toPositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;

  return value.toLowerCase() === 'true';
};

const normalizedChatProvider = (process.env.CHAT_PROVIDER ?? (process.env.GROQ_API_KEY ? 'groq' : 'openai')).toLowerCase();
const normalizedEmbeddingProvider = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();

export const chatConfig = {
  enabled: process.env.NEXT_PUBLIC_CHAT_WIDGET_ENABLED !== 'false',
  provider: normalizedChatProvider === 'groq' ? 'groq' : 'openai',
  model:
    process.env.CHAT_MODEL ??
    (normalizedChatProvider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
  openAiApiKey: process.env.OPENAI_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  sessionExpiryHours: toPositiveInteger(process.env.CHAT_SESSION_EXPIRY_HOURS, 24),
  otpExpiryMinutes: toPositiveInteger(process.env.OTP_EXPIRY_MINUTES, 5),
  otpMaxAttempts: toPositiveInteger(process.env.OTP_MAX_ATTEMPTS, 3),
  rateLimitPerMinute: toPositiveInteger(process.env.CHAT_RATE_LIMIT_PER_MINUTE, 30),
  rateLimitPerHour: toPositiveInteger(process.env.CHAT_RATE_LIMIT_PER_HOUR, 500),
  embeddingProvider: normalizedEmbeddingProvider === 'openai' ? 'openai' : 'none',
  embeddingApiKey: process.env.EMBEDDING_API_KEY,
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL,
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  embeddingDimension: toPositiveInteger(process.env.EMBEDDING_DIMENSION, 1536),
  otpDeliveryMode: process.env.CHAT_OTP_DELIVERY_MODE ?? 'console',
  resendApiKey: process.env.RESEND_API_KEY,
  otpFromEmail:
    process.env.OTP_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    'STUDIO NEXT <support@studionextinc.com>',
  includeDebugOtp: toBoolean(process.env.CHAT_INCLUDE_DEBUG_OTP, process.env.NODE_ENV !== 'production'),
};