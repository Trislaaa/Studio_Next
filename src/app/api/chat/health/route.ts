import { NextResponse } from 'next/server';
import { chatConfig } from '@/lib/chat/config';

export async function GET() {
  const status = {
    enabled: chatConfig.enabled,
    provider: chatConfig.provider,
    groqConfigured: Boolean(chatConfig.groqApiKey),
    groqBaseUrl: chatConfig.groqBaseUrl,
    otpDeliveryMode: chatConfig.otpDeliveryMode,
    resendConfigured: Boolean(chatConfig.resendApiKey && chatConfig.otpFromEmail),
    includeDebugOtp: chatConfig.includeDebugOtp,
    embeddingProvider: chatConfig.embeddingProvider,
    embeddingConfigured:
      chatConfig.embeddingProvider === 'openai'
        ? Boolean(chatConfig.embeddingApiKey ?? chatConfig.openAiApiKey)
        : false,
  };

  return NextResponse.json({ ok: true, status }, { headers: { 'Cache-Control': 'no-store' } });
}
