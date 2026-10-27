/**
 * Which OpenAI-compatible host serves the key in `grok_api_key`.
 * Groq keys start with gsk_ and are rejected by x.ai, so the prefix picks the
 * host; grok_base_url / grok_model override either without a redeploy (D18).
 * Groq's default model reasons before answering and can spend a short
 * max_tokens budget on reasoning alone, so it runs at low effort.
 */
export interface LlmEndpoint {
  baseURL: string;
  model: string;
  reasoningEffort: "low" | null;
}

export function llmEndpoint(key: string, env: { grok_base_url?: string; grok_model?: string }): LlmEndpoint {
  const groq = key.startsWith("gsk_");
  return {
    baseURL: env.grok_base_url || (groq ? "https://api.groq.com/openai/v1" : "https://api.x.ai/v1"),
    model: env.grok_model || (groq ? "openai/gpt-oss-120b" : "grok-3-mini"),
    reasoningEffort: groq ? "low" : null,
  };
}
