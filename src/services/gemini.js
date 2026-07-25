/**
 * Gemini AI service
 * Uses gemini-3.5-flash — best stable model for coding and agentic tasks
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-3.5-flash'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Generate a Mission Brief for a specific task against a real repo
 */
export async function generateMissionBrief(repoData, task) {
  const prompt = buildMissionBriefPrompt(repoData, task)

  const response = await callGemini(prompt)
  return response
}

/**
 * Generate repo-level analysis: hotspots + onboarding
 * Called once when the repo loads — before the user types a task
 */
export async function generateRepoAnalysis(repoData) {
  const prompt = buildRepoAnalysisPrompt(repoData)
  const response = await callGemini(prompt)
  return response
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildMissionBriefPrompt(repoData, task) {
  const dirSummary = repoData.directories
    .sort((a, b) => b.totalLOC - a.totalLOC)
    .slice(0, 20)
    .map(
      (d) =>
        `${d.name}/ (${d.fileCount} files, ~${d.totalLOC} LOC, types: ${d.types.join(', ')}):\n` +
        d.topFiles.map((f) => `  - ${f.path} (~${f.linesOfCode} LOC)`).join('\n')
    )
    .join('\n\n')

  return `You are Waypoint, an AI developer context engine. Analyze this real GitHub repository and generate a precise Mission Brief for the given task.

REPOSITORY: ${repoData.repo.name}
Description: ${repoData.repo.description}
Primary language: ${repoData.repo.language}
Total files: ${repoData.repo.totalFiles}
Total LOC: ${repoData.repo.totalLOC}

REPOSITORY STRUCTURE (directories with key files):
${dirSummary}

DEVELOPER TASK: "${task}"

Generate a Mission Brief that tells a developer exactly what they need to know to complete this task. Be specific to this actual repository structure — don't invent files that don't exist.

Respond with ONLY a valid JSON object matching this schema exactly:
{
  "confidence": <number 70-98>,
  "confidenceReason": "<one sentence why this confidence level>",
  "risk": "<Low|Medium|High>",
  "estimatedEffort": "<e.g. 2-3 hours, 1-2 days>",
  "summary": "<2-3 sentence summary of what this task involves in this specific repo>",
  "ignoredCount": <number of files NOT relevant>,
  "prerequisites": [
    {
      "concept": "<concept name>",
      "description": "<why they need to understand this>",
      "files": ["<actual file paths from the repo>"],
      "estimatedTime": "<e.g. 15 min>"
    }
  ],
  "relevantFiles": [
    {
      "path": "<actual file path from the repo>",
      "reason": "<specific reason this file is relevant>",
      "priority": "<primary|secondary>",
      "linesOfCode": <number>,
      "riskScore": <1-10>,
      "lines": "<e.g. 45-120 or null>",
      "warning": "<specific warning about this file or null>"
    }
  ],
  "knownTraps": [
    {
      "title": "<short trap name>",
      "file": "<file path>",
      "severity": "<critical|warning|info>",
      "description": "<what the trap is>",
      "recommendation": "<how to avoid it>"
    }
  ],
  "route": [
    {
      "order": <number>,
      "file": "<file path>",
      "action": "<specific action to take in this file>"
    }
  ]
}`
}

function buildRepoAnalysisPrompt(repoData) {
  const allFiles = repoData.files
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 30)
    .map((f) => `${f.path} (${f.linesOfCode} LOC, risk: ${f.riskScore}, type: ${f.type})`)
    .join('\n')

  return `You are Waypoint. Analyze this repository and return risk hotspots and onboarding lessons.

REPOSITORY: ${repoData.repo.name}
Language: ${repoData.repo.language}
Top files by risk score:
${allFiles}

Respond with ONLY valid JSON:
{
  "hotspots": [
    {
      "path": "<file path>",
      "semanticPurpose": "<what this file does>",
      "riskScore": <1-10>,
      "riskAnalysis": "<why it's risky>",
      "prodIncidents": <0-5>,
      "refactoringSuggestion": "<actionable suggestion>"
    }
  ],
  "onboarding": {
    "roles": {
      "Frontend": {
        "estimatedTime": "<e.g. 2 hours>",
        "lessons": [
          {
            "title": "<lesson title>",
            "description": "<what to learn>",
            "estimatedTime": "<e.g. 20 min>",
            "keyFiles": ["<file paths>"],
            "insight": "<key insight about this area>"
          }
        ]
      },
      "Backend": {
        "estimatedTime": "<e.g. 3 hours>",
        "lessons": []
      },
      "Bug Fixes": {
        "estimatedTime": "<e.g. 1 hour>",
        "lessons": []
      }
    }
  }
}`
}

// ─── Core API call ─────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured. Add it to your .env file.')
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,          // Low temp = consistent, factual output
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini API error: ${err?.error?.message || res.status}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) throw new Error('Empty response from Gemini')

  // Strip markdown code fences if present
  const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('Gemini returned invalid JSON. Try again.')
  }
}
