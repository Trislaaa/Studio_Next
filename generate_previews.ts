import { buildConfirmationEmail } from './src/lib/email/templates/booking-confirmation';
import { buildCancellationEmail } from './src/lib/email/templates/booking-cancellation';
import { buildCheckInReminderEmail } from './src/lib/email/templates/checkin-reminder';
import { buildCheckoutThankyouEmail } from './src/lib/email/templates/checkout-thankyou';
import fs from 'fs';
import path from 'path';

const mockData = {
  confirmation: {
    guestName: "Studio next",
    guestEmail: "Studio next@example.com",
    bookingReference: "OMK-20260404-A1B2C3D4",
    roomType: "Luxury Suite",
    roomNumber: "302",
    checkIn: "2026-04-10",
    checkOut: "2026-04-12",
    numberOfGuests: 2,
    numberOfNights: 2,
    totalAmount: 14500,
    taxAmount: 1553,
    paymentMethod: "Razorpay Online",
    specialRequests: "High floor if possible, anniversary stay.",
    addons: ["Breakfast", "Airport Pickup"]
  },
  cancellation: {
    guestName: "Studio next",
    guestEmail: "Studio next@example.com",
    bookingReference: "OMK-20260404-A1B2C3D4",
    roomType: "Luxury Suite",
    checkIn: "2026-04-10",
    checkOut: "2026-04-12",
    totalAmount: 14500,
    refundAmount: 7250,
    cancellationReason: "Change of travel plans"
  },
  reminder: {
    guestName: "Studio next",
    guestEmail: "Studio next@example.com",
    bookingReference: "OMK-20260404-A1B2C3D4",
    roomType: "Luxury Suite",
    roomNumber: "302",
    checkIn: "2026-04-10",
    checkOut: "2026-04-12",
    numberOfGuests: 2,
    numberOfNights: 2,
    specialRequests: "Extra towels"
  },
  thankyou: {
    guestName: "Studio next",
    guestEmail: "Studio next@example.com",
    bookingReference: "OMK-20260404-A1B2C3D4",
    roomType: "Luxury Suite",
    checkIn: "2026-04-10",
    checkOut: "2026-04-12",
    numberOfNights: 2,
    totalAmount: 14500,
    taxAmount: 1553,
    paymentMethod: "Razorpay Online"
  }
};

const outputDir = path.join(process.cwd(), 'tmp_previews');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

fs.writeFileSync(path.join(outputDir, 'confirmation.html'), buildConfirmationEmail(mockData.confirmation));
fs.writeFileSync(path.join(outputDir, 'cancellation.html'), buildCancellationEmail(mockData.cancellation));
fs.writeFileSync(path.join(outputDir, 'reminder.html'), buildCheckInReminderEmail(mockData.reminder));
fs.writeFileSync(path.join(outputDir, 'thankyou.html'), buildCheckoutThankyouEmail(mockData.thankyou));

console.log('Previews generated in tmp_previews/');
