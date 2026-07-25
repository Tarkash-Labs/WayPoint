/**
 * AI Router Service
 * Implements a resilient waterfall fallback strategy for multi-model reasoning.
 */

// We will dynamically import the Gemini implementation to avoid circular dependencies
// if gemini.js imports aiRouter.js.
import { callGemini, buildDeepMissionPrompt } from './gemini'

const NVIDIA_NIM_CHAT_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions'

/**
 * Gemini Provider (Primary)
 */
const GeminiProvider = {
  name: 'Gemini 3.5 Flash',
  async run(prompt) {
    console.log(`[AI Router] Attempting primary provider: ${this.name}`)
    // The existing callGemini function already handles the fetch and error throwing
    return await callGemini(prompt)
  }
}

/**
 * Gemma 4 31B Provider (NVIDIA NIM)
 */
const GemmaProvider = {
  name: 'Gemma 4 31B (NVIDIA)',
  async run(prompt) {
    console.log(`[AI Router] Falling back to provider: ${this.name}`)
    return await callNvidiaNimChat('google/gemma-4-31b-it', prompt)
  }
}

/**
 * DeepSeek V4 Flash Provider (NVIDIA NIM)
 */
const DeepSeekProvider = {
  name: 'DeepSeek V4 Flash (NVIDIA)',
  async run(prompt) {
    console.log(`[AI Router] Falling back to provider: ${this.name}`)
    return await callNvidiaNimChat('deepseek-ai/deepseek-v4-flash', prompt)
  }
}

/**
 * Unified provider array
 */
const providers = [
  GeminiProvider,
  GemmaProvider,
  DeepSeekProvider
]

/**
 * Executes a prompt through the AI Router, automatically falling back if a provider fails.
 */
export async function executeRoutedPrompt(prompt) {
  let lastError = null
  
  for (const provider of providers) {
    try {
      const response = await provider.run(prompt)
      
      // If we got here, it succeeded!
      console.log(`[AI Router] Success using ${provider.name}`)
      return { response, providerName: provider.name }
      
    } catch (err) {
      console.warn(`[AI Router] ${provider.name} failed:`, err.message)
      lastError = err
      // Loop continues to next provider
    }
  }
  
  // If all providers failed
  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`)
}

// --- Helper for NVIDIA NIM Chat completions ---

async function callNvidiaNimChat(model, prompt) {
  const apiKey = import.meta.env.VITE_NVIDIA_NIM_API_KEY
  if (!apiKey) throw new Error(`Missing VITE_NVIDIA_NIM_API_KEY for ${model}`)

  const res = await fetch(NVIDIA_NIM_CHAT_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2048,
    })
  })

  if (!res.ok) {
    throw new Error(`NIM HTTP ${res.status}: ${res.statusText}`)
  }

  const data = await res.json()
  const content = data.choices[0]?.message?.content || ""
  
  return parseJsonFromText(content)
}

function parseJsonFromText(text) {
  try {
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error("Failed to parse JSON from AI response:", text)
    throw new Error("Invalid JSON response from AI")
  }
}
