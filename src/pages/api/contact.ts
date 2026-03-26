import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { z } from 'zod';
import logger from '../../lib/logger';

export const prerender = false;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  hasWebsite: z.enum(['yes', 'no']),
  companyName: z.string().trim().min(2).max(120),
  questions: z.string().trim().max(5000).optional().default(''),
  websiteUrl: z.string().trim().max(120).optional().default(''),
});

export const POST: APIRoute = async ({ request }) => {
  const requestId = createRequestId();
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const log = logger.child({
    requestId,
    ip,
    userAgent,
    route: 'contact',
  });

  try {
    const formData = await request.formData();
    const rawPayload = {
      name: String(formData.get('name') ?? ''),
      hasWebsite: String(formData.get('hasWebsite') ?? ''),
      companyName: String(formData.get('companyName') ?? ''),
      questions: String(formData.get('questions') ?? ''),
      websiteUrl: String(formData.get('websiteUrl') ?? ''),
    };

    const parsed = contactSchema.safeParse(rawPayload);
    if (!parsed.success) {
      log.warn(
        {
          event: 'contact.validation_failed',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        },
        'Contact form validation failed'
      );

      return json({ ok: false, error: 'Please fill all fields correctly.' }, 400);
    }

    const payload = parsed.data;

    if (payload.websiteUrl) {
      return json({ ok: true }, 200);
    }

    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? 'info@ambl.ca';
    const fromName = import.meta.env.RESEND_FROM_NAME ?? 'Ambl Contact Form';
    const toEmails = ['ben@ambl.ca']
    // const toEmails = [fromEmail, 'ben@ambl.ca', 'rachel@ambl.ca'];

    if (!resendApiKey) {
      log.error({ event: 'contact.resend_key_missing' }, 'Missing Resend API key');

      return json({ ok: false, error: 'Contact form is unavailable right now.' }, 500);
    }

    const subject = `New contact form message from ${payload.name}`;
    const text = [
      `Name: ${payload.name}`,
      `Has website: ${payload.hasWebsite}`,
      `Company name: ${payload.companyName}`,
      '',
      'Questions:',
      payload.questions || 'No questions submitted.',
    ].join('\n');

    try {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: toEmails,
        subject,
        text,
      });

      if (error) {
        throw {
          statusCode: error.statusCode,
          body: error,
        };
      }
    } catch (error) {
      const providerError = isProviderError(error)
        ? {
          statusCode: error.statusCode,
          body: error.body,
        }
        : {
          message: error instanceof Error ? error.message : String(error),
        };

      log.error(
        {
          event: 'contact.resend_failed',
          providerError,
        },
        'Failed to send contact email via Resend'
      );

      return json({ ok: false, error: 'Message failed to send. Please try again soon.' }, 502);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    log.error(
      {
        event: 'contact.unexpected_error',
        message: error instanceof Error ? error.message : String(error),
      },
      'Unexpected contact handler error'
    );

    return json({ ok: false, error: 'Unexpected server error.' }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function createRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
  );
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return 'unknown';
  }

  return forwardedFor.split(',')[0]?.trim() || 'unknown';
}

function isProviderError(error: unknown): error is { statusCode: number; body: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}
