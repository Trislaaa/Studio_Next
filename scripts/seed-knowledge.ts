import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { BROCHURE_KNOWLEDGE_CONTEXT } from '../src/lib/chat/brochure-context';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL must be configured');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as PrismaClient & {
  knowledgeDocument: Prisma.KnowledgeDocumentDelegate;
};

type SeedDocument = {
  category: string;
  title: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown>;
};

function toInputJsonValue(value: Record<string, unknown> | undefined) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

async function upsertKnowledgeDocument(document: SeedDocument) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: {
      category: document.category,
      title: document.title,
      source: document.source,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        content: document.content,
        metadata: toInputJsonValue(document.metadata),
        isActive: true,
      },
    });
  }

  return prisma.knowledgeDocument.create({
    data: {
      category: document.category,
      title: document.title,
      source: document.source,
      content: document.content,
      metadata: toInputJsonValue(document.metadata),
      isActive: true,
    },
  });
}

function buildStaticKnowledgeDocuments(): SeedDocument[] {
  const brochureContent = [
    'Studio Next Brochure & Specifications',
    BROCHURE_KNOWLEDGE_CONTEXT,
  ].join('\n\n');

  const contactContent = [
    'STUDIO NEXT Headquarters & Contact Details',
    'Company: Studio Next Technology Pvt. Ltd.',
    'Headquarters Address: 508, K.P. Aurum, Marol Maroshi Road, Andheri (East), Mumbai – 400059, Maharashtra, India.',
    'Phone: +91 93247 47424 / 022 29203411 / 022 29205594',
    'Email: admin@studionextinc.com / support@studionextinc.com',
    'Website: https://www.studionextinc.com',
    'Regional Presence: Mumbai, Noida, Tirupur, Surat, Ludhiana, Bangalore, Kolkata, Ahmedabad.',
  ].join('\n\n');

  const cadSoftwareContent = [
    'STUDIO NEXT GetonAgain CAD Software Suite',
    '1. GetonAgain Garment CAD V2024.1: Professional pattern design, grading & marker making software.',
    'Features: Intuitive pattern design tools, accurate grading for all size runs, efficient marker making with minimum fabric waste, compatible with DXF, DXF AAMA, IBA, GGT, TMP, and Richpeace formats, 3D garment simulation, automated measurement and specification sheets, bulk production marker planning, customizable shortcuts.',
    'Version: V2024.1 | Platform: Windows | Support: Lifetime & Online | Best For: Garment Manufacturers.',
    'Applications: Garment pattern making for all apparel categories, size grading for retail/export orders, production marker planning, sample development, technical specification sheet generation.',
    'Trusted by 6000+ installations.',
    '',
    '2. GetonAgain Photo Digitizing Software: AI-powered auto-digitizing from photos.',
    'Features: AI-powered auto-digitizing, convert any garment image to editable CAD pattern, intelligent edge detection and curve smoothing, support for JPG, PNG, BMP, TIFF formats, auto-grade patterns after digitizing, manual refinement tools, export to all major CAD formats.',
    'Reduces pattern development time by up to 80%. Best for design studios.',
    '',
    '3. GetonAgain SuperNest: Cost-effective automatic marker making solution.',
    'Features: Automatic marker making with advanced algorithms, up to 85%+ fabric utilization optimization, bulk nesting for multiple orders, manual editing with real-time tracking, pattern matching and stripe/plaid alignment, direct cutting room integration.',
    'Reduces marker planning time by up to 90%. Best for bulk production.',
  ].join('\n\n');

  const cadHardwareContent = [
    'STUDIO NEXT SCOPE CAD Hardware Products',
    '1. SCOPE Inkjet Plotter: High-speed CAD printing for bulk marker and pattern output.',
    'Features: High-speed printing, precision inkjet technology, roll-fed media support, low operating cost, network-ready, durable for 24/7 production, compatible with all major CAD formats.',
    'Technology: Inkjet Printing | Media: Roll-Fed Paper | Resolution: 600x600 DPI | Width: Up to 72". Best for bulk production.',
    '',
    '2. SCOPE Vertical Inkjet Cutter Plotter: All-in-one cutting & drawing solution.',
    'Features: Dual-function CAD drawing and precision cutting, vertical design saves floor space, auto tool head switching between pen and blade, cuts paper/cardstock/film, high-precision servo motor.',
    'Function: Draw & Cut | Design: Vertical Stand | Best For: Sample Rooms.',
    '',
    '3. Flatbed Inkjet Cutting Plotter: High-speed precision sample cutting.',
    'Features: Flatbed design for stable cutting, high-speed inkjet printing with integrated cutting, precision blade with adjustable depth/force, handles fabric/paper/film, CAD-integrated workflow.',
    'Type: Flatbed Cutter/Printer | Best For: Sample Development.',
    '',
    '4. Pattern Digitizer: Convert physical patterns to digital CAD files.',
    'Features: High-accuracy optical digitizing, convert to DXF/major CAD formats, large digitizing area, eliminates manual digitizing errors.',
    'Technology: Optical Digitizing | Accuracy: Sub-millimeter | Best For: Pattern Archiving.',
    '',
    '5. SCOPE Pro Vertical Inkjet Cutter Plotter: Professional-grade automatic cutting.',
    'Features: Heavy-duty vertical design, automatic tool head with pen/blade switching, high-speed cutting, up to 800g cutting force, Ethernet/USB/Wi-Fi.',
    'Grade: Professional | Best For: Heavy-Duty Production Use.',
    '',
    '6. SCOPE Pro HX Series Automatic Fabric Spreader: Precision spreading for bulk production.',
    'Features: Automatic spreading with programmable layer counts, tension-free spreading, face-to-face and face-to-one-side modes, edge alignment system, auto cutter bar.',
    'Up to 72" width, 300 layers capacity, up to 100 m/min speed. Best for bulk cutting.',
  ].join('\n\n');

  const camSolutionsContent = [
    'STUDIO NEXT CAM Solutions (SCOPE Pro Production Series)',
    '1. SCOPE Pro HX Series Spreader: Advanced automatic fabric spreading machine.',
    'Up to 72" width, 300 layers, 100 m/min speed. Saves up to 3% fabric waste. Best for bulk cutting rooms.',
    '',
    '2. SCOPE Pro – The Denim Cutter: Specialized cutting for denim & heavy fabrics.',
    'Features: Reinforced cutting head, specialized blade system, high-pressure vacuum for multi-layer denim cutting, handles rigid/stretch/blended denim.',
    'Best for denim manufacturers.',
    '',
    '3. CYG YIN Automatic Fabric Cutting Machine: High-precision CNC fabric cutting.',
    'Features: High-speed automatic cutting, servo motor control, handles woven/knit/non-woven, computer-controlled cutting head, vacuum table, auto blade sharpening.',
    'Best for bulk production.',
    '',
    '4. SCOPE Automatic Fabric Cutting Machine: Intelligent cutting room automation.',
    'Features: Automated cutting with intelligent tool path optimization, servo-driven head, multi-ply cutting, vacuum fixation, direct CAD integration, touchscreen interface.',
    'Industrial-grade for 24/7 operation.',
    '',
    '5. SCOPE Automatic High Speed Sample Cutting Machine: Rapid sample development.',
    'Features: High-speed cutting, precision blade with adjustable depth/force, single-ply/small batch cutting, quick material changeover, CAD integration, compact footprint.',
    'Best for design studios.',
    '',
    '6. SCOPE Automatic Fabric Spreading Machine: Efficient spreading for bulk production.',
    'Features: Automatic spreading with consistent tension control, programmable layer counts, edge alignment, all fabric types, digital layer counter, auto cutter bar.',
    'Up to 72" width, 300 layers, 100 m/min. Saves up to 3% fabric waste.',
  ].join('\n\n');

  const machineryContent = [
    'STUDIO NEXT Machinery & Cutting Room Automation',
    '1. Magic Inkjet Plotter Pro Series (SN-MJ/2-160 to SN-MJ/4-220): High-speed HP45 plotters up to 200 m²/h, 600 DPI.',
    '2. H185-4 Inkjet Plotter: 185 cm print width, double-injection head, 90 m²/h.',
    '3. Vertical & Flatbed Cutter Plotters: SN-MJ-KC series, XH-1600AL/1800AL/2000AL, GOA-SP flatbed cutters.',
    '4. Scope Pro Spreading Machines (YS-160/190/210, YS-HX series): Max width up to 83", woven/knitted one-way & zigzag spreading.',
    '5. Scope Pro CNC Fabric Cutters: Multi-ply (YS-2517 to YS-3323) compressed lay height 5/7/11cm, single-ply (B4 series), compact cutters (YS-1818, YS-2018).',
    '6. Fabric Inspection Machines (TF-100, TF-260) and Motorized PVC Conveyor Spreading Tables (PA-SSD-01, PA-SSD-02).',
  ].join('\n\n');

  const faqContent = [
    'STUDIO NEXT Frequently Asked Questions',
    'Q: Where is Studio Next headquartered?',
    'A: Studio Next is headquartered at 508, K.P. Aurum, Marol Maroshi Road, Andheri (East), Mumbai – 400059.',
    '',
    'Q: How can I contact Studio Next for sales or technical support?',
    'A: You can reach Studio Next by calling +91 93247 47424 or 022 29203411, or emailing admin@studionextinc.com.',
    '',
    'Q: What training programs does Studio Next offer?',
    'A: Studio Next offers a 110-hour comprehensive CAD training program delivered over 2 months in convenient modules for Garment Masters and students.',
    '',
    'Q: Can I see live machine demonstrations?',
    'A: Yes, Studio Next operates an Experience Center at its Mumbai headquarters showcasing live demonstrations of CAD software, plotters, spreading machines, and CNC cutters.',
    '',
    'Q: Does Studio Next support Richpeace CAD files?',
    'A: Yes, Studio Next provides dedicated file conversion support for Richpeace CAD users via support@studionextinc.com.',
  ].join('\n');

  return [
    {
      category: 'brochure',
      title: 'Studio Next Official Brochure',
      source: 'internal:brochure',
      content: brochureContent,
      metadata: { section: 'brochure' },
    },
    {
      category: 'contact',
      title: 'Studio Next Address & Contact Info',
      source: 'internal:contact',
      content: contactContent,
      metadata: { section: 'contact' },
    },
    {
      category: 'cad-software',
      title: 'Studio Next GetonAgain CAD Software Products',
      source: 'internal:cad-software',
      content: cadSoftwareContent,
      metadata: { section: 'cad-software' },
    },
    {
      category: 'cad-hardware',
      title: 'Studio Next SCOPE CAD Hardware Products',
      source: 'internal:cad-hardware',
      content: cadHardwareContent,
      metadata: { section: 'cad-hardware' },
    },
    {
      category: 'cam-solutions',
      title: 'Studio Next CAM Solutions',
      source: 'internal:cam-solutions',
      content: camSolutionsContent,
      metadata: { section: 'cam-solutions' },
    },
    {
      category: 'machinery',
      title: 'Studio Next Machinery & Hardware',
      source: 'internal:machinery',
      content: machineryContent,
      metadata: { section: 'machinery' },
    },
    {
      category: 'faq',
      title: 'Studio Next FAQ',
      source: 'internal:faq',
      content: faqContent,
      metadata: { section: 'faq' },
    },
  ];
}

async function main() {
  console.log('Seeding Studio Next chatbot knowledge documents...');

  // Deactivate old non-brochure documents to purge any legacy hotel data
  await prisma.knowledgeDocument.updateMany({
    where: {
      category: { in: ['rooms', 'policy', 'nearby'] },
    },
    data: { isActive: false },
  });

  const documents = buildStaticKnowledgeDocuments();

  for (const document of documents) {
    await upsertKnowledgeDocument(document);
    console.log(`Seeded: ${document.title}`);
  }

  console.log(`Knowledge seeding completed. Total documents: ${documents.length}`);
}

main()
  .catch((error) => {
    console.error('Knowledge seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

