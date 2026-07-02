import { CLAUDE_API_KEY } from './supabase';
import { getName, type LeadNameFields } from './leadName';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(prompt: string): Promise<string> {
  try {
    const res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  } catch {
    return '';
  }
}

// ─── Transcribe a voice note and write a professional CRM call summary ──────
export async function generateCallSummary(rawTranscript: string, leadName: string): Promise<string> {
  if (!rawTranscript.trim()) return '';
  const prompt = `You are a CRM assistant for Prowin Properties, a Dubai real estate agency.
An agent just finished a call with "${leadName}" and recorded this rough voice note:

"${rawTranscript}"

Write a SHORT, professional CRM call summary in 2-3 sentences. Include:
- What the client wants (property type, area, budget if mentioned)
- Client's interest level and key concerns
- Recommended next action for the agent

Be concise and professional. Do NOT use bullet points — write as flowing sentences.`;
  return await callClaude(prompt);
}

// ─── Auto-generate a lead summary from lead data ────────────────────────────
export async function generateLeadSummary(lead: LeadNameFields & {
  property_type?: string;
  area?: string;
  budget?: string;
  source?: string;
  notes?: string;
}): Promise<string> {
  const displayName = getName(lead);
  const prompt = `You are a CRM assistant for Prowin Properties Dubai.
Generate a SHORT 1-2 sentence smart summary for this new lead to help the agent quickly understand who this is:

Name: ${displayName}
Property type: ${lead.property_type ?? 'Unknown'}
Area of interest: ${lead.area ?? 'Unknown'}
Budget: ${lead.budget ?? 'Unknown'}
Source: ${lead.source ?? 'Unknown'}
Notes: ${lead.notes ?? 'None'}

Write a professional, helpful 1-2 sentence insight about this lead and suggest the best first action.`;
  return await callClaude(prompt);
}

// ─── Generate a follow-up message for WhatsApp or email ─────────────────────
export async function generateFollowUpMessage(
  leadName: string,
  propertyInterest: string,
  messageType: 'whatsapp' | 'email'
): Promise<string> {
  const prompt = `Write a short, friendly ${messageType === 'whatsapp' ? 'WhatsApp message' : 'email'} 
from a Prowin Properties Dubai agent to a client named ${leadName} who is interested in ${propertyInterest}.

The message should:
- Be warm and professional
- Reference their property interest briefly  
- Ask if they are available for a quick call or viewing
- Be short (${messageType === 'whatsapp' ? '3-4 sentences max' : '5-6 sentences max'})
- End with the agent's name placeholder [Agent Name]

${messageType === 'email' ? 'Include a subject line at the top prefixed with "Subject:"' : ''}`;
  return await callClaude(prompt);
}
