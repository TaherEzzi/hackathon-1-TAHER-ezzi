import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { llmEndpoint } from "./llm-endpoint";

describe("llmEndpoint", () => {
  it("sends a Groq key (gsk_) to Groq's OpenAI-compatible API", () => {
    assert.deepEqual(llmEndpoint("gsk_abc", {}), { baseURL: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", reasoningEffort: "low" });
  });

  it("sends an xAI key to x.ai with the Grok model and no reasoning setting", () => {
    assert.deepEqual(llmEndpoint("xai-abc", {}), { baseURL: "https://api.x.ai/v1", model: "grok-3-mini", reasoningEffort: null });
  });

  it("lets the environment override host and model", () => {
    assert.deepEqual(llmEndpoint("gsk_abc", { grok_base_url: "https://example.test/v1", grok_model: "m1" }), { baseURL: "https://example.test/v1", model: "m1", reasoningEffort: "low" });
  });
});
