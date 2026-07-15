import { supabase } from './supabase';

/** Production Next.js CRM (same host that serves /api/ai-assistant). */
export const CRM_API_BASE = 'https://crm.prowinproperties.com';

export type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiAssistantResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; status?: number };

async function getBearerToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** POST chat turns to the web AI Assistant endpoint (server does tools + Claude). */
export async function postAiAssistant(messages: AiChatMessage[]): Promise<AiAssistantResult> {
  const token = await getBearerToken();
  if (!token) {
    return { ok: false, error: "You're not signed in. Please log in again." };
  }

  try {
    const res = await fetch(`${CRM_API_BASE}/api/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { reply?: string; error?: string }
      | null;

    if (!res.ok) {
      if (res.status === 403) {
        return {
          ok: false,
          error: "You don't have access to the AI Assistant.",
          status: 403,
        };
      }
      return {
        ok: false,
        error: payload?.error?.trim() || 'Something went wrong. Please try again.',
        status: res.status,
      };
    }

    const reply = payload?.reply?.trim() || "I don't have a reply for that.";
    return { ok: true, reply };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
