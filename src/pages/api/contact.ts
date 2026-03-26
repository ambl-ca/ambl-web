import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { z } from 'zod';

export const prerender = false;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  hasWebsite: z.enum(['yes', 'no']),
  companyName: z.string().trim().min(2).max(120),
  questions: z.string().trim().max(5000).optional().default(''),
  websiteUrl: z.string().trim().max(120).optional().default(''),
});

type ContactPayload = z.infer<typeof contactSchema>;

type ContactEmailConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  toEmails: string[];
};

export const POST: APIRoute = async ({ request }) => {
  const payload = await parseContactPayload(request);
  if (!payload) {
    return json({ ok: false, error: 'Please fill all fields correctly.' }, 400);
  }

  if (isHoneypotSubmission(payload)) {
    return json({ ok: true }, 200);
  }

  const emailConfig = getContactEmailConfig();
  if (!emailConfig) {
    return json({ ok: false, error: 'Contact form is temporarily unavailable.' }, 503);
  }

  const sent = await sendContactEmail(payload, emailConfig);
  if (!sent) {
    return json(
      { ok: false, error: 'We could not deliver your message right now. Please try again soon.' },
      502
    );
  }

  return json({ ok: true }, 200);
};

function json(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function parseContactPayload(request: Request): Promise<ContactPayload | null> {
  const formData = await request.formData();
  const parsed = contactSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    hasWebsite: String(formData.get('hasWebsite') ?? ''),
    companyName: String(formData.get('companyName') ?? ''),
    questions: String(formData.get('questions') ?? ''),
    websiteUrl: String(formData.get('websiteUrl') ?? ''),
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function isHoneypotSubmission(payload: ContactPayload): boolean {
  return Boolean(payload.websiteUrl);
}

function getContactEmailConfig(): ContactEmailConfig | null {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? 'info@ambl.ca';
  return {
    apiKey,
    fromEmail,
    fromName: import.meta.env.RESEND_FROM_NAME ?? 'Ambl Contact Form',
    // toEmails: [fromEmail, 'ben@ambl.ca', 'rachel@ambl.ca'],
    toEmails: ['ben@ambl.ca']
  };
}

async function sendContactEmail(
  payload: ContactPayload,
  config: ContactEmailConfig
): Promise<boolean> {
  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: config.toEmails,
      subject: `New contact form message from ${payload.name}`,
      text: buildContactEmailBody(payload),
    });

    return !error;
  } catch {
    return false;
  }
}

function buildContactEmailBody(payload: ContactPayload): string {
  return [
    `Name: ${payload.name}`,
    `Has website: ${payload.hasWebsite}`,
    `Company name: ${payload.companyName}`,
    '',
    'Questions:',
    payload.questions || 'No questions submitted.',
  ].join('\n');
}
