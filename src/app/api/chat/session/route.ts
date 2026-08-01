import { NextRequest, NextResponse } from 'next/server';
import { chatConfig } from '@/lib/chat/config';
import { createChatSession } from '@/lib/chat/session';

export async function POST(request: NextRequest) {
  try {
    if (!chatConfig.enabled) {
      return NextResponse.json(
        { success: false, error: 'Chatbot is disabled' },
        { status: 503 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = request.headers.get('user-agent');

    const session = await createChatSession({
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json(
      {
        success: true,
        session: {
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          isVerified: session.isVerified,
        },
      },
      { status: 201 }
    );

    response.cookies.set('chat_session_token', session.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: session.expiresAt,
    });

    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Chat session creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat session' },
      { status: 500 }
    );
  }
}
