import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { chatConfig } from '../src/lib/chat/config';

async function main() {
  const contact = process.argv[2] || process.env.TEST_OTP_CONTACT;
  if (!contact) {
    console.error('Usage: npm run chat:test-otp -- <contact> or set TEST_OTP_CONTACT env var');
    process.exit(2);
  }

  const otp = process.env.TEST_OTP_CODE || `${Math.floor(100000 + Math.random() * 900000)}`;

  console.log('Contact:', contact);
  console.log('Delivery mode:', chatConfig.otpDeliveryMode);

  // Simulate delivery for console mode (safe for local/staging tests)
  if (chatConfig.otpDeliveryMode === 'console' || process.env.NODE_ENV !== 'production') {
    console.log(`[CHAT_OTP] ${contact} -> ${otp}`);
    console.log('Delivery result:', { sent: true, channel: 'console', debugOtp: chatConfig.includeDebugOtp ? otp : undefined });
    process.exit(0);
  }

  // If resend/email mode is configured, notify the user to use staging or configure keys
  if (chatConfig.otpDeliveryMode === 'resend') {
    console.log('Resend delivery mode is configured. This script does not perform real email delivery.');
    console.log('Set CHAT_OTP_DELIVERY_MODE=console and CHAT_INCLUDE_DEBUG_OTP=true to test locally.');
    process.exit(1);
  }

  console.log('No delivery performed.');
  process.exit(1);
}

main();
