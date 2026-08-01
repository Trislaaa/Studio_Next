const { z } = require('zod');

const updateSchema = z.object({
  roomType: z.enum(['DELUXE', 'SUITE', 'FAMILY', 'STANDARD']),
  floor: z.number().int().nullable(),
  baseRate: z.number().min(0),
  weekendAdjustment: z.number().min(0),
  extraGuestCharge: z.number().min(0),
  effectiveFrom: z.string().optional(),
});

const body = {
  roomType: "DELUXE",
  floor: null,
  baseRate: 0,
  weekendAdjustment: 0,
  extraGuestCharge: 500,
  effectiveFrom: "2026-04-19"
};

try {
    const data = updateSchema.parse({
      ...body,
      floor: body.floor === null ? null : Number(body.floor),
      baseRate: typeof body.baseRate === 'string' ? Number(body.baseRate) : body.baseRate,
      weekendAdjustment: typeof body.weekendAdjustment === 'string' ? Number(body.weekendAdjustment) : body.weekendAdjustment,
      extraGuestCharge: typeof body.extraGuestCharge === 'string' ? Number(body.extraGuestCharge) : body.extraGuestCharge,
    });
    console.log("Success:", data);
} catch (e) {
    console.log("Validation failed:", JSON.stringify(e.issues, null, 2));
}
