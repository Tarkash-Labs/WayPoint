import { executeRoutedPrompt } from './aiRouter'
import { getCachedLocalRepo } from './localFs'
import { parseFileToDocument } from './parser'
import { buildRepositoryIndex, retrieveSimilarFiles, hasIndex } from './embeddings'

/**
 * 1. Build Knowledge Index (Called on Repo Load)
 * Parses every file into a rich Document and embeds it using NVIDIA NIM.
 */
export async function buildKnowledgeIndex(repoData) {
  console.log(`[Analyzer] Building Knowledge Index for ${repoData.files.length} files...`)
  
  const documents = []
  
  // For a hackathon demo, we limit the indexing to top ~100 files to avoid massive API limits
  // In production, we'd batch all of them.
  const filesToIndex = repoData.files.slice(0, 100)
  
  for (const file of filesToIndex) {
    const sourceCode = await fetchSourceCode(repoData, file.path)
    // Parse into the rich Knowledge Document string
    const docString = parseFileToDocument(file.path, sourceCode)
    
    documents.push({
      path: file.path,
      docString
    })
  }
  
  await buildRepositoryIndex(documents)
  console.log('[Analyzer] Knowledge Index build complete.')
}

/**
 * 2. Fetch the actual source code of a file
 * Handles both GitHub and Local file systems.
 */
async function fetchSourceCode(repoData, filePath) {
  try {
    if (repoData.source === 'local') {
      const rootHandle = repoData.localHandle
      if (!rootHandle) throw new Error('Local handle missing')
      
      const parts = filePath.split('/')
      let currentHandle = rootHandle
      
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) {
          const fileHandle = await currentHandle.getFileHandle(parts[i])
          const file = await fileHandle.getFile()
          return await file.text()
        } else {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i])
        }
      }
    } else {
      // repoData.repo.name is in 'owner/repo' format (set by buildRepoData)
      const [owner, repo] = repoData.repo.name.split('/')
      const branch = repoData.repo.defaultBranch || 'main'
      
      const res = await fetch(`/api/raw-github/${owner}/${repo}/${branch}/${filePath}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    }
  } catch (err) {
    console.error(`Failed to fetch source for ${filePath}:`, err)
    return `// Error loading source: ${err.message}`
  }
}

/**
 * 3. Extract structural semantics (For final Deep Read prompt)
 * (We still need raw structure to pass into the final LLM context)
 */
function extractStructure(sourceCode) {
  const lines = sourceCode.split('\n')
  const structure = { imports: [], exports: [], functions: [], classes: [] }
  
  lines.forEach((line) => {
    const text = line.trim()
    if (text.startsWith('import ')) structure.imports.push(text)
    else if (text.startsWith('export ')) structure.exports.push(text)
    else if (text.match(/^(async\s+)?function\s+(\w+)/)) structure.functions.push(text.split('{')[0].trim())
    else if (text.match(/^(export\s+)?class\s+(\w+)/)) structure.classes.push(text.split('{')[0].trim())
  })
  
  return structure
}

/**
 * THE DEEP READ PIPELINE (RAG Architecture)
 */
export async function executeDeepReadTask(repoData, taskQuery) {
  console.log('--- Deep Read Pipeline Started (RAG) ---')
  
  if (!hasIndex()) {
    console.warn("Index not found. Building on the fly...")
    await buildKnowledgeIndex(repoData)
  }
  
  // Step 1: Semantic Search via NV-EmbedCode
  const top20 = await retrieveSimilarFiles(taskQuery, 20)
  console.log(`[Analyzer] Semantic retrieval found 20 nearest neighbors.`)
  
  // Step 2: Adaptive Deep Read Sizing
  let deepReadCount = 3
  if (repoData.files.length > 50) deepReadCount = 5
  if (repoData.files.length > 200) deepReadCount = 7
  
  const aiSelectedPaths = top20.slice(0, deepReadCount).map(doc => doc.path)
  const relatedPaths = top20.slice(deepReadCount, deepReadCount + 5).map(doc => doc.path) // The "Also Consider" files
  
  // Step 3: Fetch Source & Extract Structure for Deep Read
  const deepFiles = []
  for (const path of aiSelectedPaths) {
    const rawSource = await fetchSourceCode(repoData, path)
    const structure = extractStructure(rawSource)
    
    // Semantic Truncation
    const MAX_LINES = 300
    const rawLines = rawSource.split('\n')
    const truncatedSource = rawLines.length > MAX_LINES 
      ? rawLines.slice(0, MAX_LINES).join('\n') + `\n\n... [${rawLines.length - MAX_LINES} lines omitted]`
      : rawSource
      
    deepFiles.push({ path, structure, source: truncatedSource })
  }
  
  // Step 4: Generate the Deep Mission Brief via the AI Router
  const sourceContext = deepFiles.map(f => `
--- FILE: ${f.path} ---
IMPORTS: ${f.structure.imports.join(', ') || '(none)'}
EXPORTS: ${f.structure.exports.join(', ') || '(none)'}
FUNCTIONS: ${f.structure.functions.join(', ') || '(none)'}
CLASSES: ${f.structure.classes.join(', ') || '(none)'}

SOURCE SNIPPET:
${f.source}
-----------------------
  `).join('\n\n')

  const prompt = `You are Waypoint, an elite AI developer context engine.
You have actively read the source code of the most critical files for the developer's task.

DEVELOPER TASK: "${taskQuery}"

DEEP READ SOURCE CODE:
${sourceContext}

Generate a precise Mission Brief that tells the developer exactly what to do. Because you have the source code, be highly specific. Mention actual function names, classes, and specific architectural files.

Respond with ONLY a valid JSON object matching this schema exactly:
{
  "prerequisites": ["List of things they must understand first (e.g., 'This repo uses Redux for state', or 'Authentication is JWT-based')"],
  "filesToTouch": [
    { "path": "exact file path", "reason": "Why edit this? Be specific (e.g. 'Update the validateToken function')" }
  ],
  "knownTraps": ["List of subtle gotchas or mistakes they might make based on the source code structure (e.g. 'Don't forget to export the new route in index.js')"],
  "routeSteps": ["Step-by-step action plan to complete the task"]
}
NO MARKDOWN BLOCKS. JUST VALID JSON.`

  const result = await executeRoutedPrompt(prompt)
  const missionPlan = result.response
  
  return {
    mission: missionPlan,
    provider: result.providerName,
    evidence: {
      filesAnalyzed: deepFiles.length,
      functionsInspected: deepFiles.reduce((acc, f) => acc + f.structure.functions.length, 0),
      candidatesRanked: repoData.files.length,
      deepFiles: deepFiles.map(f => f.path), // used for "Why These Files" view
      relatedFiles: relatedPaths // used for "Also Consider" view
    }
  }
}
