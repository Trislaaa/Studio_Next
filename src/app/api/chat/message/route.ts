import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { chatConfig } from '@/lib/chat/config';
import { getChatClient } from '@/lib/chat/llm-client';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/chat/prompt';
import { checkChatRateLimit } from '@/lib/chat/rate-limit';
import {
  buildKnowledgeContext,
  detectChatIntent,
} from '@/lib/chat/knowledge';
import {
  getActiveChatSession,
  touchChatSession,
} from '@/lib/chat/session';
import { BROCHURE_KNOWLEDGE_CONTEXT } from '@/lib/chat/brochure-context';

const chatMessageSchema = z.object({
  sessionToken: z.string().min(1).optional(),
  message: z.string().min(1).max(4000),
});

function getSessionToken(request: NextRequest, body: { sessionToken?: string }) {
  return body.sessionToken ?? request.cookies.get('chat_session_token')?.value ?? null;
}

function getFallbackReply() {
  return 'Welcome to Studio Next Technology! I can help with information about our Garment CAD V2024.1 software, SuperNest automatic nesting, Photo Digitizing software, Magic Inkjet plotters, Scope Pro fabric spreading & CNC cutting machines, job-work services, 110-hour training programs, and Mumbai headquarters address. Please ask a specific question!';
}

// Local keyword-based response engine (no LLM needed)
function getLocalReply(query: string): string {
  const q = query.toLowerCase();

  // Define knowledge sections with keywords and responses
  const sections: { keywords: string[]; label: string; response: string }[] = [
    {
      keywords: ['getonagain', 'cad software', 'cad suite', 'getonagain cad', 'ga-garment', 'ga cad', 'getonagain garment'],
      label: 'GetonAgain CAD Suite',
      response: `Here's an overview of our **GetonAgain CAD Software Suite**: 

🖥️ **GetonAgain Garment CAD V2024.1** — Professional pattern design, grading & marker making. Features: intuitive pattern design tools, accurate size grading, efficient marker making, DXF/AAMA/IBA/GGT/TMP/Richpeace compatibility, 3D garment simulation, automated spec sheets, bulk production planning. Best for garment manufacturers. Trusted by 6000+ installations.

📷 **GetonAgain Photo Digitizing Software** — AI-powered auto-digitizing that converts garment photos into editable CAD patterns. Intelligent edge detection, curve smoothing, supports JPG/PNG/BMP/TIFF, auto-grading after digitizing. Reduces pattern development time by up to 80%. Best for design studios.

🔄 **GetonAgain SuperNest** — Cost-effective automatic marker making with up to 85%+ fabric utilization. Bulk nesting for multiple orders, manual editing with real-time tracking, stripe/plaid alignment, pattern matching. Reduces marker planning time by up to 90%. Best for bulk production.`,
    },
    {
      keywords: ['software', 'garment cad', 'pattern design', 'pds', 'grading', 'marker', 'cad/cam', 'cad cam', 'supernest', 'photo digitizing', 'ipen', 'down-filling', '3d', 'digitizer board', 'ga-d3648c', 'ga-d4460c', 'richpeace'],
      label: 'Software Products',
      response: `Here's an overview of our **software solutions**:

🖥️ **Garment CAD V2024.1** — Our flagship CAD system for Pattern Design (PDS), Pattern Grading, and Marker Making. Features include the iPen intelligent pen tool, DIY keyboard shortcuts, 3D/2D modeling, layer application, auto down-filling, and DXF/HPGL/PLT file compatibility.

🔄 **SuperNest** — High-efficiency automatic marker nesting software that maximizes fabric utilization and reduces wastage.

📷 **Photo Digitizing Software** — Camera-based system that instantly converts physical paper patterns into digital CAD files.

📐 **Pattern Digitizer Boards** — Model GA-D3648C (A0, 36"×48") and GA-D4460C (A00, 44"×60") for accurate manual tracing.

🖥️ **GetonAgain CAD Suite** — We also offer GetonAgain Garment CAD V2024.1, GetonAgain Photo Digitizing (AI-powered), and GetonAgain SuperNest for advanced pattern design and nesting.`,
    },
    {
      keywords: ['cad hardware', 'scope inkjet', 'scope plotter', 'scope cutter', 'pattern digitizer', 'hardware', 'scope vertical inkjet', 'scope pro vertical', 'optical digitizing', 'scope professional series', 'inkjet cutting plotter'],
      label: 'CAD Hardware Products',
      response: `Here's an overview of our **SCOPE CAD Hardware products**:

🖨️ **SCOPE Inkjet Plotter** — High-speed CAD printing for bulk marker and pattern output. Thermal Inkjet, up to 72" media width, 600x600 DPI, Ethernet/USB. Best for bulk production.

✂️ **SCOPE Vertical Inkjet Cutter Plotter** — All-in-one draw & cut. Vertical design saves space, auto pen/blade switching, servo motor precision. Best for sample rooms.

🖥️ **Flatbed Inkjet Cutting Plotter** — High-speed precision sample cutting with integrated inkjet printing. Flatbed design, blade + inkjet, handles fabric/paper/film. Best for sample development.

📐 **Pattern Digitizer** — Optical digitizing converts physical patterns to digital CAD files. Sub-millimeter precision, up to 5x faster than manual. Best for pattern archiving.

⚙️ **SCOPE Pro Vertical Inkjet Cutter Plotter** — Professional-grade automatic draw & cut. Auto tool head, up to 800g cutting force, Ethernet/USB/Wi-Fi. For heavy-duty production.

📏 **SCOPE Pro HX Series Automatic Fabric Spreader** — Automatic spreading with programmable layers. Up to 72" width, 300 layers, 100 m/min. Tension-free, handles all fabric types. Best for bulk cutting.`,
    },
    {
      keywords: ['plotter', 'inkjet', 'print', 'printing', 'magic inkjet', 'vertical cutter', 'flatbed', 'sn-mj', 'h185', 'x-h series', 'xh-1600', 'xh-1800', 'xh-2000', 'goa-sp', 'hp45', 'sn-mj-kc'],
      label: 'Inkjet Plotters & Cutter Plotters',
      response: `Here are our **inkjet plotters & cutter plotters**:

🖨️ **Magic Inkjet Plotter Pro Series (SN-MJ)** — Available in 2/4 cartridge models (160cm to 220cm width). Speeds up to 110 m²/h (2-cartridge) or 200 m²/h (4-cartridge), 0.025mm resolution, compatible with 40-120g CAD paper.

⚡ **H185-4 High-Speed Plotter** — 185cm print width, 90 m²/h speed, 150-600 DPI with line thickness adjustment.

✂️ **Vertical Inkjet Cutter Plotter (SN-MJ-KC)** — Combined inkjet printing (110 m²/h) + cutting (up to 1000 mm/s) with rotating knife.

✂️ **XH Series Cutter Plotters** — 65-85 m²/h, double paper feeding, touch control panel.

✂️ **Flatbed Inkjet Cutting Plotter (GOA-SP)** — Cutting areas 1200×900mm or 1500×1200mm, vacuum adsorption, 1000 mm/s cutting speed.`,
    },
    {
      keywords: ['spreading', 'spreader', 'fabric spreading', 'spreading machine', 'scope pro', 'conveyor', 'inspection', 'ys-160', 'ys-190', 'ys-210', 'ys-hx', 'tf-100', 'tf-260', 'pa-ssd', 'rewinding', 'edge alignment', 'tensionless'],
      label: 'Fabric Spreading & Inspection',
      response: `Here's information on our **fabric spreading & inspection equipment**:

📏 **Scope Pro Fabric Spreading Machines** (YS-160/190/210, YS-HX190/HX210) — Max fabric width up to 83" (2100mm), travel speed up to 90 m/min, lay height up to 300mm. Supports one-way, zigzag, and multiple-length spreading.

🔍 **Fabric Inspection Machines** (TF-100 / TF-260) — Tensionless inspection, auto edge-alignment, digital length counter.

🔄 **Spreading Tables & PVC Conveyor Tables** (PA-SSD-01/02) — E1-grade plywood tops with dark grey matte PVC belt. Energy-efficient synchronized transport (90%+ more efficient than air flotation tables).`,
    },
    {
      keywords: ['cam solutions', 'cam solution', 'denim cutter', 'cyg yin', 'sample cutting machine', 'auto fabric cutter', 'production cutting', 'cam solution', 'denim', 'sample cutter', 'production series', 'cutting room automation'],
      label: 'CAM Solutions',
      response: `Here's an overview of our **CAM (Computer-Aided Manufacturing) Solutions**:

🏭 **SCOPE Pro HX Series Spreader** — Automatic fabric spreading for high-volume cutting rooms. Up to 72" width, 300 layers, 100 m/min. Saves up to 3% fabric waste. Best for bulk cutting rooms.

✂️ **SCOPE Pro – The Denim Cutter** — Specialized cutting for denim and heavy fabrics. Reinforced blade system, high-pressure vacuum, multi-ply cutting. Handles rigid, stretch & blended denim. Best for denim manufacturers.

⚙️ **CYG YIN Automatic Fabric Cutting Machine** — High-precision CNC cutting for mass production. Servo motor control, vacuum table, auto blade sharpening, CAD network integration. Best for bulk production.

🖥️ **SCOPE Automatic Fabric Cutting Machine** — Intelligent cutting room automation. Multi-ply CNC cutting, vacuum fixation, touchscreen interface, auto blade wear compensation. Industrial-grade for 24/7 operation.

📐 **SCOPE Automatic High Speed Sample Cutting Machine** — Rapid sample development. High-speed precision blade cutting, quick material changeover, compact for design studios. Best for sample development.

📏 **SCOPE Automatic Fabric Spreading Machine** — Efficient spreading with consistent tension control. Programmable layers, edge alignment, all fabric types. Best for cutting rooms.`,
    },
    {
      keywords: ['cnc', 'cutting machine', 'fabric cutting', 'cutter', 'multi-ply', 'single-ply', 'compact cutter', 'b4 series', 'automatic cutter', 'ys-2517', 'ys-2520', 'ys-2523', 'ys-3317', 'ys-3320', 'ys-3323', 'ys-1818', 'ys-2018', 'b4-1518c', 'b4-2516c', 'b4-2518c', 'knife sharpener', 'oscillating'],
      label: 'CNC Fabric Cutting Machines',
      response: `Here are our **automatic CNC fabric cutting machines**:

🏭 **Scope Pro Multi-Ply CNC Cutters** (YS-2517 to YS-3323) — Compressed cutting height up to 11cm, 60 m/min mechanical speed, Japanese servo motors, high-pressure vacuum system, 30kW power.

🏭 **Scope Pro Compact CNC Cutters** (YS-1818/YS-2018) — 1800×1800mm or 1800×2000mm cutting area, 90mm lay height, 15-20 m/min cutting speed, low noise (<73 dB).

🏭 **B4 Series Single-Ply Cutters** (B4-1518C/B4-2516C/B4-2518C) — For PVC, TPU, PU, synthetic leather up to 10mm thickness. Repeat precision ≤0.01mm, optional rotary wheel knife & punching tools.`,
    },
    {
      keywords: ['training', 'program', 'course', '110', 'hour', 'learn', 'education', 'student', 'technical training'],
      label: 'Training Programs',
      response: `Here's information about our **training programs**:

🎓 **110-Hour Professional Technical Training Program** — A 2-month structured program delivered in convenient modules. Designed for Garment Masters, pattern makers, and industry students. Hands-on training on Garment CAD V2024.1, grading techniques, marker efficiency, and automated cutting room workflows.`,
    },
    {
      keywords: ['experience center', 'demo', 'demonstration', 'visit', 'showroom', 'live', 'hands-on'],
      label: 'Experience Center',
      response: `**Visit our Experience Center in Mumbai!**

📍 **Location:** Studio Next Mumbai Headquarters — 508, K.P. Aurum, Marol Maroshi Road, Andheri East, Mumbai – 400059.

🔬 A state-of-the-art facility featuring live hands-on demonstrations of CAD software, inkjet plotters, automatic spreading machines, and CNC cutters. Experience our complete cutting room automation solutions in action!

📞 Call +91 93247 47424 / 022 29203411 to schedule your visit.`,
    },
    {
      keywords: ['contact', 'address', 'phone', 'email', 'location', 'headquarters', 'mumbai', 'andheri', 'reach', 'support', 'helpline'],
      label: 'Contact Information',
      response: `Here's how to **reach Studio Next Technology**:

📍 **Headquarters:** 508, K.P. Aurum, Marol Maroshi Road, Andheri (East), Mumbai – 400059, Maharashtra, India.

📞 **Phone:** +91 93247 47424 / 022 29203411 / 022 29205594

📧 **Email:** admin@studionextinc.com | support@studionextinc.com

🌐 **Website:** https://www.studionextinc.com

🏢 **Branches:** Mumbai, Noida, Tirupur, Surat, Ludhiana, Bangalore, Kolkata, Ahmedabad, and major garment manufacturing hubs nationwide.`,
    },
    {
      keywords: ['job work', 'job-work', 'design studio', 'sampling', 'pattern making', 'pattern grading', 'marker making', 'digitizing', 'richpeace', 'garment'],
      label: 'Design Studio & Services',
      response: `Here are our **design studio & job-work services**:

✂️ **Design Studio & Job-Work** — Professional pattern making, grading, marker optimization, technical sheets, and digitizing services.

👕 **Sampling Unit** — Focused sampling unit converting design ideas and tech packs into finished, production-ready garments.

🔄 **Richpeace File Conversion** — Specialized conversion support for Richpeace CAD users. Email support@studionextinc.com for assistance.`,
    },
    {
      keywords: ['company', 'about', 'studio next', 'history', 'founded', 'established', 'overview', 'who are you', 'mission'],
      label: 'Company Overview',
      response: `**About Studio Next Technology Pvt. Ltd.**

🏢 **Founded:** 2003 | **Mission:** "Technology for all at an Honest Price"

📊 **Scale:** Over 6,000 installations across India.

🌐 **Branch Network:** Mumbai (HQ), Noida, Tirupur, Surat, Ludhiana, Bangalore, Kolkata, Ahmedabad, and major garment manufacturing hubs nationwide.

🎯 **Core Domain:** Leading CAD/CAM solutions provider for complete cutting room automation — pattern design software, automatic nesting, fabric spreading, CNC fabric cutting, inspection systems, and industry training.

👥 **Target Industries:** Apparel & Fashion, Footwear, Bags & Leather Goods, Home Furnishings, Automobile Interiors, Technical Textiles, Educational Institutes & Fashion Academies.`,
    },
  ];

  // Score each section by keyword matches
  let bestSection = sections[0];
  let bestScore = 0;
  let matched = false;

  for (const section of sections) {
    const score = section.keywords.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
      matched = true;
    }
  }

  if (matched && bestScore >= 1) {
    return bestSection.response;
  }

  // Check for "pricing" or "price" or "cost" keywords
  if (/price|cost|rate|how much|fee|charges/i.test(q)) {
    return `For **pricing and quotations**, please contact our sales team directly:

📞 **Phone:** +91 93247 47424 / 022 29203411
📧 **Email:** admin@studionextinc.com

Pricing varies based on the specific product model, configuration, and your requirements. Our team will be happy to provide a customized quote!`;
  }

  // Return the generic fallback
  return getFallbackReply();
}

export async function POST(request: NextRequest) {
  try {
    if (!chatConfig.enabled) {
      return NextResponse.json(
        { success: false, error: 'Chatbot is disabled' },
        { status: 503 }
      );
    }

    const body = chatMessageSchema.parse(await request.json());
    const sessionToken = getSessionToken(request, body);

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Chat session is required' },
        { status: 400 }
      );
    }

    const session = await getActiveChatSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chat session expired or not found' },
        { status: 410 }
      );
    }

    const intent = detectChatIntent(body.message);

    // Rate limit check with DB failure fallback — allow through if DB is unavailable
    try {
      const rateLimit = await checkChatRateLimit(session.id);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Please wait and try again.',
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfterSeconds),
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    } catch (rateLimitError) {
      console.warn('Rate limit check failed (DB may be unavailable), proceeding:', rateLimitError);
    }

    // Persist user message — non-critical, skip on failure
    try {
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: body.message,
          intent,
        },
      });
    } catch (dbError) {
      console.warn('Failed to persist user message (DB may be unavailable):', dbError);
    }

    let assistantReply = '';
    let requiresVerification = false;

    // Build knowledge context with DB failure fallback
    let knowledgeContext = '';
    try {
      knowledgeContext = await buildKnowledgeContext(body.message, 3);
    } catch (kbError) {
      console.warn('Knowledge base query failed (DB may be unavailable):', kbError);
    }

    if (knowledgeContext) {
      const llmClient = getChatClient();

      if (llmClient) {
        try {
          // Try to fetch recent messages for context — skip on failure
          let transcript = '';
          try {
            const recentMessages = await prisma.chatMessage.findMany({
              where: { sessionId: session.id },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                role: true,
                content: true,
              },
            });

            transcript = recentMessages
              .reverse()
              .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
              .join('\n');
          } catch (histError) {
            console.warn('Failed to fetch message history (DB may be unavailable):', histError);
          }

          const completion = await llmClient.chat.completions.create({
            model: chatConfig.model,
            messages: [
              {
                role: 'system',
                content: CHATBOT_SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: `Conversation so far:\n${transcript || 'No previous conversation history available.'}\n\nBrochure context:\n${knowledgeContext}\n\nUser question: ${body.message}`,
              },
            ],
            max_tokens: 300,
            temperature: 0.3,
          });

          assistantReply = completion.choices[0]?.message?.content?.trim() || assistantReply;
        } catch (llmError) {
          console.error('Chat LLM response error:', llmError);
          assistantReply = `${assistantReply} I am having trouble generating a detailed response right now.`;
        }
      } else {
        assistantReply = getLocalReply(body.message);
      }
    } else {
      // No DB context available — use local keyword-based reply engine
      assistantReply = getLocalReply(body.message);
    }

    // Persist assistant reply — non-critical, skip on failure
    try {
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: assistantReply,
          intent,
          modelUsed: chatConfig.model,
        },
      });
    } catch (dbError) {
      console.warn('Failed to persist assistant reply (DB may be unavailable):', dbError);
    }

    // Touch session — non-critical, skip on failure
    try {
      await touchChatSession(session.id);
    } catch (touchError) {
      console.warn('Failed to touch session (DB may be unavailable):', touchError);
    }

    return NextResponse.json({
      success: true,
      reply: assistantReply,
      intent,
      sessionToken,
      isVerified: false,
      requiresVerification,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid chat payload', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('Chat message error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

