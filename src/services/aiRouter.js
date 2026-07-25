/**
 * AI Router Service
 * Implements a resilient waterfall fallback strategy for multi-model reasoning.
 * All API calls go through the Vite proxy (/api/nvidia/*) to avoid CORS.
 */

import { callGemini, buildDeepMissionPrompt } from './gemini'

// Proxied through Vite dev server — see vite.config.js
const NVIDIA_NIM_CHAT_BASE = '/api/nvidia/v1/chat/completions'

/**
 * Gemini Provider (Primary)
 */
const GeminiProvider = {
  name: 'Gemini 3.5 Flash',
  async run(prompt) {
    console.log(`[AI Router] Attempting primary provider: ${this.name}`)
    return await callGemini(prompt)
  }
}

/**
 * DeepSeek V4 Flash Provider (NVIDIA NIM)
 * Uses the thinking/reasoning mode as per the official API docs.
 */
const DeepSeekProvider = {
  name: 'DeepSeek V4 Flash (NVIDIA)',
  async run(prompt) {
    console.log(`[AI Router] Falling back to provider: ${this.name}`)
    return await callDeepSeekV4Flash(prompt)
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
 * Unified provider array — DeepSeek is now second (stronger reasoning model)
 */
const providers = [
  GeminiProvider,
  DeepSeekProvider,
  GemmaProvider
]

/**
 * Executes a prompt through the AI Router, automatically falling back if a provider fails.
 */
export async function executeRoutedPrompt(prompt) {
  let lastError = null
  
  for (const provider of providers) {
    try {
      const response = await provider.run(prompt)
      
      // Validate that we got a real object back, not empty/null
      if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
        throw new Error('Provider returned empty response')
      }
      
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

// --- DeepSeek V4 Flash (with thinking mode) ---

async function callDeepSeekV4Flash(prompt) {
  const apiKey = import.meta.env.VITE_NVIDIA_NIM_API_KEY
  if (!apiKey) throw new Error('Missing VITE_NVIDIA_NIM_API_KEY for DeepSeek V4 Flash')

  const res = await fetch(NVIDIA_NIM_CHAT_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      chat_template_kwargs: { thinking: true, reasoning_effort: 'high' },
      stream: false
    })
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`DeepSeek NIM HTTP ${res.status}: ${res.statusText} — ${errBody}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]?.message

  if (!choice) {
    throw new Error('DeepSeek returned no choices')
  }

  // DeepSeek thinking models return reasoning in `reasoning` or `reasoning_content`,
  // and the actual answer in `content`.
  const reasoning = choice.reasoning || choice.reasoning_content
  if (reasoning) {
    console.log('[AI Router] DeepSeek reasoning trace received (hidden from user)')
  }

  const content = choice.content || ''
  if (!content.trim()) {
    throw new Error('DeepSeek returned empty content')
  }

  return parseJsonFromText(content)
}

// --- Helper for generic NVIDIA NIM Chat completions ---

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
      max_tokens: 4096,
    })
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`NIM HTTP ${res.status}: ${res.statusText} — ${errBody}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  if (!content.trim()) {
    throw new Error(`${model} returned empty content`)
  }

  return parseJsonFromText(content)
}

/**
 * Robust JSON extraction from AI text responses.
 * Handles markdown fences, leading/trailing text, and nested JSON.
 */
function parseJsonFromText(text) {
  // Step 1: Strip markdown code fences
  let cleaned = text
    .replace(/^```json\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/^```\s*\n?/i, '')
    .trim()

  // Step 2: Try parsing directly
  try {
    return JSON.parse(cleaned)
  } catch {
    // Continue to fallback strategies
  }

  // Step 3: Extract the outermost JSON object from the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue
    }
  }

  // Step 4: Extract the outermost JSON array
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {
      // Continue
    }
  }

  console.error('[AI Router] Failed to parse JSON from AI response:', text.substring(0, 500))
  throw new Error('Invalid JSON response from AI')
}

export { buildDeepMissionPrompt }
