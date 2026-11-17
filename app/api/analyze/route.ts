import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/system-prompt';
import {
  DEFAULT_PARENT_PRECALL_PROMPT,
  DEFAULT_PARENT_POSTCALL_PROMPT,
  DEFAULT_BOOKING_PROMPT,
  DEFAULT_PARENT_REFERENCE,
} from '@/lib/parent-prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// mode → which saved prompt, its default, and the output ceiling
const MODES: Record<string, { key: string; fallback: string; maxTokens: number }> = {
  athlete:     { key: 'system_prompt',          fallback: DEFAULT_SYSTEM_PROMPT,          maxTokens: 8000 },
  parent_prep: { key: 'parent_precall_prompt',  fallback: DEFAULT_PARENT_PRECALL_PROMPT,  maxTokens: 5000 },
  parent_post: { key: 'parent_postcall_prompt', fallback: DEFAULT_PARENT_POSTCALL_PROMPT, maxTokens: 8000 },
  booking:     { key: 'booking_prompt',         fallback: DEFAULT_BOOKING_PROMPT,         maxTokens: 1200 },
};

export async function POST(request: NextRequest) {
  try {
    const { transcript, repName, mode: rawMode, athleteTranscript } = await request.json();
    const mode = rawMode && MODES[rawMode] ? rawMode : 'athlete';
    const cfg = MODES[mode];

    if (!transcript || (mode !== 'booking' && !repName)) {
      return Response.json({ error: 'Missing transcript or repName' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const getSetting = async (key: string) => {
      const { data } = await supabase.from('settings').select('value').eq('key', key).single();
      return data?.value as string | undefined;
    };

    let fullSystemPrompt = (await getSetting(cfg.key)) || cfg.fallback;

    if (mode === 'athlete') {
      const objectionDoc = await getSetting('objection_doc');
      if (objectionDoc) {
        fullSystemPrompt += `\n\n---\n\n## OBJECTION HANDLING REFERENCE\n\nWhen suggesting sharper versions for objection moments, reference these examples for tone and approach:\n\n${objectionDoc}`;
      }
    }

    if (mode === 'parent_prep' || mode === 'parent_post') {
      const reference = (await getSetting('parent_reference')) || DEFAULT_PARENT_REFERENCE;
      fullSystemPrompt += `\n\n---\n\n## PARENT CALL REFERENCE LIBRARY\n\nThis is the real Next Play parent-call process. Judge and suggest ONLY within it.\n\n${reference}`;
      if (repName) fullSystemPrompt += `\n\n---\n\nThe closer on this call is ${repName}.`;
    }

    // Build the user message
    let userContent: string = transcript;
    if (mode === 'parent_post') {
      userContent =
        `=== ATHLETE INTERVIEW TRANSCRIPT (context only — do not grade) ===\n` +
        (athleteTranscript && String(athleteTranscript).trim() ? athleteTranscript : '[No athlete interview on file for this family]') +
        `\n\n=== PARENT CALL TRANSCRIPT (grade this call) ===\n${transcript}`;
    }

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: cfg.maxTokens,
      system: fullSystemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, fullText })}\n\n`));
          }
        }

        // Log why the model stopped (end_turn = finished naturally, max_tokens = hit ceiling)
        try {
          const finalMessage = await stream.finalMessage();
          console.log(`[analyze:${mode}] stop_reason:`, finalMessage.stop_reason, '| output_tokens:', finalMessage.usage?.output_tokens);
        } catch (e) {
          console.error(`[analyze:${mode}] could not read finalMessage:`, e);
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return Response.json({ error: 'Failed to analyze transcript' }, { status: 500 });
  }
}
