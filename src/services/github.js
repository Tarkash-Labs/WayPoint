/**
 * GitHub REST API service
 * Fetches real repository data - no auth token required for public repos
 */

const GITHUB_API = 'https://api.github.com'

/**
 * Parse a GitHub URL into owner + repo
 * Handles: https://github.com/owner/repo, github.com/owner/repo, owner/repo
 */
export function parseGitHubUrl(input) {
  const clean = input.trim().replace(/\.git$/, '')
  const match = clean.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)/)
  if (!match) throw new Error('Invalid GitHub URL. Use: github.com/owner/repo')
  return { owner: match[1], repo: match[2] }
}

/**
 * Fetch repository metadata
 */
export async function fetchRepoMeta(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`)
  if (res.status === 404) throw new Error(`Repository "${owner}/${repo}" not found. Is it public?`)
  if (res.status === 403) throw new Error('GitHub rate limit hit. Try again in a minute.')
  if (!res.ok) throw new Error(`GitHub error: ${res.status}`)
  return res.json()
}

/**
 * Fetch the full recursive file tree
 * Uses the git trees API — much faster than contents API for large repos
 */
export async function fetchFileTree(owner, repo, defaultBranch = 'main') {
  // Try main, fall back to master
  const branches = [defaultBranch, defaultBranch === 'main' ? 'master' : 'main']

  for (const branch of branches) {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    )
    if (res.ok) {
      const data = await res.json()
      return data.tree // array of { path, type, size }
    }
  }
  throw new Error('Could not fetch repository tree. The repository may be empty.')
}

/**
 * Build normalized repo data from raw GitHub API responses
 * This is our "static analysis" step — pure data transformation, no AI
 */
export function buildRepoData(meta, tree) {
  // Filter to blobs only (files, not trees/dirs)
  const files = tree
    .filter((item) => item.type === 'blob')
    .filter((item) => !shouldIgnore(item.path))

  // Estimate LOC from byte size (rough but reasonable: ~40 bytes/line avg)
  const withLOC = files.map((item) => ({
    path: item.path,
    directory: getDirectory(item.path),
    filename: item.path.split('/').pop(),
    extension: getExtension(item.path),
    sizeBytes: item.size || 0,
    linesOfCode: Math.round((item.size || 0) / 40),
    riskScore: calculateBaseRisk(item.path, item.size || 0),
    type: classifyFile(item.path),
  }))

  // Group files by top-level directory for Gemini context
  const directoryMap = {}
  withLOC.forEach((file) => {
    const topDir = file.path.split('/')[0]
    if (!directoryMap[topDir]) directoryMap[topDir] = []
    directoryMap[topDir].push(file)
  })

  const directories = Object.entries(directoryMap).map(([name, dirFiles]) => ({
    name,
    fileCount: dirFiles.length,
    totalLOC: dirFiles.reduce((s, f) => s + f.linesOfCode, 0),
    types: [...new Set(dirFiles.map((f) => f.type))],
    // Send only top 8 files per dir to Gemini to control token count
    topFiles: dirFiles
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 8)
      .map((f) => ({ path: f.path, linesOfCode: f.linesOfCode, type: f.type })),
  }))

  const totalLOC = withLOC.reduce((s, f) => s + f.linesOfCode, 0)

  return {
    repo: {
      name: `${meta.owner.login}/${meta.name}`,
      description: meta.description || '',
      language: meta.language || 'Unknown',
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      totalFiles: files.length,
      totalLOC,
      difficulty: totalLOC > 50000 ? 'High' : totalLOC > 15000 ? 'Medium' : 'Low',
      defaultBranch: meta.default_branch,
    },
    files: withLOC,
    directories,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /coverage\//,
  /\.min\.(js|css)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock/,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/,
]

function shouldIgnore(path) {
  return IGNORE_PATTERNS.some((p) => p.test(path))
}

function getDirectory(path) {
  const parts = path.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)'
}

function getExtension(path) {
  const match = path.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

function classifyFile(path) {
  if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(path)) return 'test'
  if (/\.(config|rc)\.(js|ts|json|yaml|yml)$/.test(path) || /^\./.test(path.split('/').pop())) return 'config'
  if (/middleware/i.test(path)) return 'middleware'
  if (/route|router|controller/i.test(path)) return 'route'
  if (/model|schema|entity/i.test(path)) return 'model'
  if (/auth|login|session|token|oauth/i.test(path)) return 'auth'
  if (/service|provider/i.test(path)) return 'service'
  if (/hook|use[A-Z]/i.test(path)) return 'hook'
  if (/component|page|view/i.test(path)) return 'component'
  if (/util|helper|lib/i.test(path)) return 'utility'
  if (/\.(md|txt|rst)$/i.test(path)) return 'docs'
  return 'source'
}

function calculateBaseRisk(path, sizeBytes) {
  let score = 1

  // Large files are riskier
  if (sizeBytes > 100000) score += 3
  else if (sizeBytes > 50000) score += 2
  else if (sizeBytes > 20000) score += 1

  // Auth/payment/middleware = high risk
  if (/auth|login|payment|billing|token|session|oauth/i.test(path)) score += 3
  if (/middleware/i.test(path)) score += 2
  if (/database|migration|schema/i.test(path)) score += 2
  if (/config|env|secret/i.test(path)) score += 2

  return Math.min(score, 10)
}
