import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TaskInput from '../components/TaskInput'
import AnalysisLoader from '../components/AnalysisLoader'
import MissionBrief from '../views/MissionBrief'
import OnboardingView from '../views/OnboardingView'
import HotspotsView from '../views/HotspotsView'
import MapView from '../views/MapView'
import AIBar from '../components/AIBar'
import { parseGitHubUrl, fetchRepoMeta, fetchFileTree, buildRepoData } from '../services/github'
import { generateRepoAnalysis } from '../services/gemini'
import { executeDeepReadTask, buildKnowledgeIndex } from '../services/analyzer'

const VIEW_TITLES = {
  task: 'What are you trying to do?',
  mission: 'Mission Brief',
  onboarding: 'AI Onboarding',
  hotspots: 'Risk Hotspots',
  map: 'Architecture Map',
}

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const repoUrl = location.state?.repoUrl || ''
  
  // Use search params for view state so browser Back button works
  const searchParams = new URLSearchParams(location.search)
  const activeView = searchParams.get('view') || 'task'
  const setActiveView = (view) => {
    navigate(`?view=${view}`, { state: location.state })
  }

  // Core data
  const [repoData, setRepoData] = useState(null)       // raw GitHub data
  const [enrichedData, setEnrichedData] = useState(null) // AI-enriched full data

  // UI state
  const [selectedTask, setSelectedTask] = useState(null)

  // Loading stages
  const [analysisStage, setAnalysisStage] = useState('fetch')
  const [isRepoLoading, setIsRepoLoading] = useState(true)
  const [isTaskLoading, setIsTaskLoading] = useState(false)
  const [error, setError] = useState(null)
  const [taskError, setTaskError] = useState(null)
  const [repoName, setRepoName] = useState('')

  // ── Phase 1: Load + analyse the repository ─────────────────────────────────
  useEffect(() => {
    loadRepository()
  }, [])

  async function loadRepository() {
    setIsRepoLoading(true)
    setError(null)

    try {
      setAnalysisStage('fetch')
      
      // Phase 1: Local Folder Drop support
      if (repoUrl === 'local://workspace') {
        const { getCachedLocalRepo } = await import('../services/localFs')
        const localRepo = getCachedLocalRepo()
        
        if (localRepo) {
          setRepoName(localRepo.repoName)
          
          // Show the animated sequence
          setAnalysisStage('tree')
          await sleep(400)
          setAnalysisStage('analyze')
          await sleep(400)
          setAnalysisStage('dirs')
          
          // Build basic directory groups for local files
          const dirMap = {}
          localRepo.files.forEach(f => {
            const dir = f.path.split('/')[0] || 'root'
            dirMap[dir] = true
          })
          localRepo.directories = Object.keys(dirMap).map(name => ({ name, files: [] }))
          
          setRepoData(localRepo)
          
          setAnalysisStage('ai')
          await sleep(400)
          setAnalysisStage('hotspots')
          
          // Trigger the Knowledge Document embedding index build (non-blocking)
          try {
            await buildKnowledgeIndex(localRepo)
          } catch (indexErr) {
            console.warn('[Dashboard] Local knowledge index build failed:', indexErr.message)
          }
          
          await sleep(400)
          setAnalysisStage('done')
          await sleep(400)
          
          const totalLOC = localRepo.files.reduce((s, f) => s + (f.linesOfCode || 0), 0)
          
          // Compute base risk scores for local files (mirrors github.js calculateBaseRisk)
          const scoredFiles = localRepo.files.map(f => ({
            ...f,
            riskScore: f.riskScore || calculateLocalRisk(f.path, f.size || 0),
            type: classifyLocalFile(f.path)
          }))
          
          // Build enriched data for local workspace
          setEnrichedData({
            repo: { name: localRepo.repoName, description: 'Local Workspace', language: 'Multiple', stars: 0, issues: 0, totalFiles: localRepo.files.length, totalLOC },
            files: scoredFiles,
            directories: localRepo.directories,
            onboarding: null, // Will trigger heuristic fallback in OnboardingView
            tasks: {}
          })
          setIsRepoLoading(false)
          return
        }
      }

      let owner, repo

      if (repoUrl && repoUrl !== 'local://workspace') {
        try {
          ;({ owner, repo } = parseGitHubUrl(repoUrl))
        } catch {
          // Fall through to mock data
        }
      }

      // If we have a real URL, fetch from GitHub
      if (owner && repo) {
        // Stage 2: repo metadata
        setAnalysisStage('fetch')
        const meta = await fetchRepoMeta(owner, repo)
        setRepoName(meta.full_name)

        // Stage 3: file tree
        setAnalysisStage('tree')
        const tree = await fetchFileTree(owner, repo, meta.default_branch)

        // Stage 4: static analysis
        setAnalysisStage('analyze')
        const rawData = buildRepoData(meta, tree)
        setRepoData(rawData)

        // Stage 5: directory grouping done — prep AI
        setAnalysisStage('dirs')
        await sleep(400) // let the UI render the dir stage

        // Stage 6: AI enrichment (resilient — if Gemini fails, we still show the dashboard)
        setAnalysisStage('ai')
        let aiAnalysis = { hotspots: [], onboarding: null }
        try {
          aiAnalysis = await generateRepoAnalysis(rawData)
        } catch (aiErr) {
          console.warn('[Dashboard] AI enrichment failed, continuing with base data:', aiErr.message)
        }

        // Stage 7: hotspots & semantic indexing
        setAnalysisStage('hotspots')
        
        // Trigger the Knowledge Document embedding index build (non-blocking)
        try {
          await buildKnowledgeIndex(rawData)
        } catch (indexErr) {
          console.warn('[Dashboard] Knowledge index build failed, semantic search unavailable:', indexErr.message)
        }
        
        await sleep(300)

        setAnalysisStage('done')
        await sleep(400)

        // Merge AI enrichment into the data shape our views expect
        setEnrichedData({
          repo: rawData.repo,
          files: mergeHotspots(rawData.files, aiAnalysis.hotspots || []),
          directories: rawData.directories,
          onboarding: aiAnalysis.onboarding || null,
          tasks: {}, // populated per-task on demand
        })
      } else {
        // No valid GitHub URL — fall back to mock data for demo
        setAnalysisStage('ai')
        await sleep(600)
        setAnalysisStage('done')
        await sleep(300)

        const mock = await fetch('/enriched_data.json').then((r) => r.json())
        setRepoName(mock.repo.name)
        setEnrichedData(mock)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRepoLoading(false)
    }
  }

  // ── Phase 2: Generate Mission Brief for a task ─────────────────────────────
  const handleTaskSubmit = async (taskName) => {
    if (!enrichedData) return
    setIsTaskLoading(true)
    setSelectedTask(null)
    setTaskError(null)

    try {
      // Check if we have pre-computed data for this task (mock fallback)
      const precomputed = enrichedData.tasks?.[taskName]

      if (precomputed) {
        await sleep(800) // feel like something is happening
        setSelectedTask({ name: taskName, ...precomputed })
      } else if (repoData) {
        // Use the new Deep Read Pipeline
        const deepReadResult = await executeDeepReadTask(repoData, taskName)
        
        setEnrichedData((prev) => ({
          ...prev,
          tasks: {
            ...prev.tasks,
            [taskName]: deepReadResult,
          },
        }))
        setSelectedTask({ name: taskName, ...deepReadResult })
      } else {
        // Mock data, unknown task — use first available task
        const firstTask = Object.values(enrichedData.tasks || {})[0]
        if (firstTask) setSelectedTask({ name: taskName, ...firstTask })
      }

      setActiveView('mission')
    } catch (err) {
      console.error('[Dashboard] Mission Brief failed:', err)
      setTaskError(`Mission Brief failed: ${err.message}`)
    } finally {
      setIsTaskLoading(false)
    }
  }

  // ── AI bar message ──────────────────────────────────────────────────────────
  const getAIMessage = () => {
    if (!enrichedData) return 'Analyzing repository structure...'
    const d = enrichedData
    if (activeView === 'task') {
      return `<strong>${d.repo.name}</strong> has ${d.repo.totalFiles} files and ${d.repo.totalLOC?.toLocaleString()} lines of code. Tell me what you're working on.`
    }
    if (activeView === 'mission' && selectedTask) {
      return `I've identified <strong>${selectedTask.relevantFiles?.length} files</strong> relevant to "${selectedTask.name}" and flagged <strong>${selectedTask.knownTraps?.length} known traps</strong>.`
    }
    if (activeView === 'hotspots') {
      const highRisk = d.files?.filter((f) => f.riskScore >= 7).length || 0
      return `This codebase has <strong>${highRisk} high-risk files</strong>. Know them before you touch anything.`
    }
    if (activeView === 'onboarding') {
      return `Choose your role and I'll create a <strong>personalized learning path</strong> through this codebase.`
    }
    if (activeView === 'map') {
      return `Architecture map of <strong>${d.repo.name}</strong>. Building height = lines of code. Color = risk level.`
    }
    return 'Ready.'
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Full-screen loader while repo is being analyzed
  if (isRepoLoading || error) {
    return (
      <div className="hud-dashboard">
        <Sidebar data={null} activeView={activeView} onViewChange={() => {}} selectedTask={null} />
        <div className="hud-main">
          <div className="hud-main__content hud-main__content--centered">
            <AnalysisLoader
              currentStage={analysisStage}
              repoName={repoName}
              error={error}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderView = () => {
    // Task-level loading spinner
    if (isTaskLoading) {
      return (
        <div className="hud-analyzing">
          <div className="hud-analyzing__spinner" />
          <div className="hud-analyzing__text">Preparing your mission brief...</div>
          <div className="hud-analyzing__subtext">
            AI is analyzing task scope, identifying relevant files, checking for known traps
          </div>
        </div>
      )
    }

    // Task-level error (non-fatal — stays in dashboard)
    if (taskError) {
      return (
        <div className="hud-analyzing">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            ⚠
          </div>
          <div className="hud-analyzing__text">{taskError}</div>
          <div className="hud-analyzing__subtext" style={{ marginBottom: '16px' }}>
            The AI providers could not generate a mission brief. Check the browser console for details.
          </div>
          <button
            onClick={() => { setTaskError(null); setActiveView('task'); }}
            className="hud-btn-primary"
          >
            Try Again
          </button>
        </div>
      )
    }

    switch (activeView) {
      case 'task':
        return <TaskInput onSubmit={handleTaskSubmit} />
      case 'mission':
        return selectedTask
          ? <MissionBrief task={selectedTask} data={enrichedData} />
          : <TaskInput onSubmit={handleTaskSubmit} />
      case 'onboarding':
        return <OnboardingView data={enrichedData} />
      case 'hotspots':
        return <HotspotsView data={enrichedData} />
      case 'map':
        return <MapView data={enrichedData} selectedTask={selectedTask} />
      default:
        return <TaskInput onSubmit={handleTaskSubmit} />
    }
  }

  return (
    <div className="hud-dashboard">
      <Sidebar
        data={enrichedData}
        activeView={activeView}
        onViewChange={setActiveView}
        selectedTask={selectedTask}
      />
      <div className="hud-main">
        <div className="hud-main__header">
          <h1 className="hud-main__title">{VIEW_TITLES[activeView] || 'Waypoint'}</h1>
        </div>
        <div className="hud-main__content">
          {renderView()}
        </div>
        <AIBar message={getAIMessage()} />
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Merge AI-generated hotspot data back into the files array
 */
function mergeHotspots(files, hotspots) {
  const hotspotMap = {}
  hotspots.forEach((h) => { hotspotMap[h.path] = h })

  return files.map((file) => {
    const hs = hotspotMap[file.path]
    if (!hs) return file
    return {
      ...file,
      riskScore: hs.riskScore ?? file.riskScore,
      semanticPurpose: hs.semanticPurpose,
      riskAnalysis: hs.riskAnalysis,
      prodIncidents: hs.prodIncidents ?? 0,
      refactoringSuggestion: hs.refactoringSuggestion,
    }
  })
}

/**
 * Calculate base risk score for local files (mirrors github.js logic)
 */
function calculateLocalRisk(path, sizeBytes) {
  let score = 1
  if (sizeBytes > 100000) score += 3
  else if (sizeBytes > 50000) score += 2
  else if (sizeBytes > 20000) score += 1
  if (/auth|login|payment|billing|token|session|oauth/i.test(path)) score += 3
  if (/middleware/i.test(path)) score += 2
  if (/database|migration|schema/i.test(path)) score += 2
  if (/config|env|secret/i.test(path)) score += 2
  return Math.min(score, 10)
}

/**
 * Classify local files by type (mirrors github.js logic)
 */
function classifyLocalFile(path) {
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
