import { generateCandidateSelection, generateDeepMissionBrief } from './gemini'
import { getCachedLocalRepo } from './localFs'

/**
 * 1. Deterministic Pre-filter: Score files based on path keywords
 * Returns top N candidates (default 15) to feed to the LLM.
 */
function rankFilesByRelevance(files, taskQuery, topN = 15) {
  const keywords = taskQuery.toLowerCase().split(/[\s,_.-]+/).filter(w => w.length > 2)
  
  const scored = files.map(file => {
    let score = 0
    const path = file.path.toLowerCase()
    
    // Core logic: keyword matches in path
    keywords.forEach(kw => {
      if (path.includes(kw)) score += 10
      // Exact filename match gets a massive boost
      if (path.split('/').pop().includes(kw)) score += 20
    })
    
    // Boost critical architectural files automatically
    if (path.includes('router') || path.includes('routes')) score += 5
    if (path.includes('config') || path.includes('setup')) score += 5
    if (path.includes('index.') || path.includes('main.')) score += 3
    if (path.includes('package.json')) score += 5
    
    return { file, score }
  })
  
  // Sort descending by score, take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.file)
}

/**
 * 2. Fetch the actual source code of a file
 * Handles both GitHub and Local file systems.
 */
async function fetchSourceCode(repoData, filePath) {
  try {
    if (repoData.source === 'local') {
      // Local folder drop — use the cached directory handle
      const rootHandle = repoData.localHandle
      if (!rootHandle) throw new Error('Local handle missing')
      
      const parts = filePath.split('/')
      let currentHandle = rootHandle
      
      // Traverse down to the file
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
      // GitHub raw fetch
      const owner = repoData.repo.full_name.split('/')[0]
      const repo = repoData.repo.name
      const branch = repoData.repo.default_branch || 'main'
      
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    }
  } catch (err) {
    console.error(`Failed to fetch source for ${filePath}:`, err)
    return `// Error loading source: ${err.message}`
  }
}

/**
 * 3. Extract structural semantics from source code (Regex-based AST proxy)
 */
function extractStructure(sourceCode, lang = 'js') {
  const lines = sourceCode.split('\n')
  const structure = {
    imports: [],
    exports: [],
    functions: [],
    classes: [],
  }
  
  // Very rough heuristic parsing for the demo
  lines.forEach((line, i) => {
    const text = line.trim()
    if (text.startsWith('import ')) structure.imports.push(text)
    else if (text.startsWith('export ')) structure.exports.push(text)
    else if (text.match(/^(async\s+)?function\s+(\w+)/)) {
      structure.functions.push(text.split('{')[0].trim())
    }
    else if (text.match(/^(export\s+)?class\s+(\w+)/)) {
      structure.classes.push(text.split('{')[0].trim())
    }
  })
  
  return structure
}

/**
 * THE DEEP READ PIPELINE
 * Combines ranking, LLM selection, source fetching, structure extraction, and final generation.
 */
export async function executeDeepReadTask(repoData, taskQuery) {
  console.log('--- Deep Read Pipeline Started ---')
  
  // Step 1: Deterministic Pre-filter
  const top15 = rankFilesByRelevance(repoData.files, taskQuery)
  console.log(`Pre-filtered to ${top15.length} candidate files.`)
  
  // Step 2: Gemini selects the BEST 3-5 files
  const aiSelectedPaths = await generateCandidateSelection(top15, taskQuery)
  console.log(`Gemini selected final target files:`, aiSelectedPaths)
  
  // Step 3: Fetch Source & Extract Structure
  const deepFiles = []
  for (const path of aiSelectedPaths) {
    const rawSource = await fetchSourceCode(repoData, path)
    const structure = extractStructure(rawSource)
    
    // Semantic Truncation (limit raw source size to save context, but keep structure)
    const MAX_LINES = 300
    const rawLines = rawSource.split('\n')
    const truncatedSource = rawLines.length > MAX_LINES 
      ? rawLines.slice(0, MAX_LINES).join('\n') + `\n\n... [${rawLines.length - MAX_LINES} lines omitted]`
      : rawSource
      
    deepFiles.push({
      path,
      structure,
      source: truncatedSource
    })
  }
  
  // Step 4: Generate the Deep Mission Brief with Evidence
  const missionPlan = await generateDeepMissionBrief(taskQuery, deepFiles)
  
  return {
    mission: missionPlan,
    evidence: {
      filesAnalyzed: deepFiles.length,
      functionsInspected: deepFiles.reduce((acc, f) => acc + f.structure.functions.length, 0),
      candidatesRanked: top15.length,
      deepFiles: deepFiles.map(f => f.path) // used for "Why These Files" view
    }
  }
}
