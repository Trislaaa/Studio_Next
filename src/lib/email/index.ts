/**
 * Email notification system — public API
 *
 * Usage:
 *   import { sendBookingConfirmation } from '@/lib/email';
 *   await sendBookingConfirmation({ ... });
 */

export { sendEmail } from './client';
export type { EmailPayload, EmailResult } from './client';

export { sendBookingConfirmation, buildConfirmationEmail } from './templates/booking-confirmation';
export type { BookingConfirmationData } from './templates/booking-confirmation';

export { sendBookingCancellation, buildCancellationEmail } from './templates/booking-cancellation';
export type { BookingCancellationData } from './templates/booking-cancellation';

export { sendManageBookingLink, buildManageBookingLinkEmail } from './templates/booking-manage-link';
export type { BookingManageLinkData } from './templates/booking-manage-link';

export { sendCheckInReminder, buildCheckInReminderEmail } from './templates/checkin-reminder';
export type { CheckInReminderData } from './templates/checkin-reminder';

export { sendCheckoutThankyou, buildCheckoutThankyouEmail } from './templates/checkout-thankyou';
export type { CheckoutThankyouData } from './templates/checkout-thankyou';
