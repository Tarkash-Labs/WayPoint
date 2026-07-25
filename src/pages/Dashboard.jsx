import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TaskInput from '../components/TaskInput'
import MissionBrief from '../views/MissionBrief'
import OnboardingView from '../views/OnboardingView'
import HotspotsView from '../views/HotspotsView'
import MapView from '../views/MapView'
import AIBar from '../components/AIBar'

const VIEW_TITLES = {
  task: 'What are you trying to do?',
  mission: 'Mission Brief',
  onboarding: 'AI Onboarding',
  hotspots: 'Risk Hotspots',
  map: 'Architecture Map',
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [activeView, setActiveView] = useState('task')
  const [selectedTask, setSelectedTask] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  useEffect(() => {
    // Simulate loading the pre-computed data
    const timer = setTimeout(() => {
      fetch('/enriched_data.json')
        .then((res) => res.json())
        .then((json) => {
          setData(json)
          setIsAnalyzing(false)
        })
    }, 1500) // Simulate analysis time
    return () => clearTimeout(timer)
  }, [])

  const handleTaskSubmit = (taskName) => {
    if (!data) return
    const taskData = data.tasks[taskName]
    if (taskData) {
      setSelectedTask({ name: taskName, ...taskData })
      setIsAnalyzing(true)
      // Simulate AI processing
      setTimeout(() => {
        setIsAnalyzing(false)
        setActiveView('mission')
      }, 1200)
    }
  }

  const handleViewChange = (view) => {
    setActiveView(view)
  }

  const getAIMessage = () => {
    if (!data) return 'Analyzing repository structure...'
    if (activeView === 'task') {
      return `<strong>${data.repo.name}</strong> has ${data.repo.totalFiles} files and ${data.repo.totalLOC.toLocaleString()} lines of code. Tell me what you're working on and I'll prepare your mission brief.`
    }
    if (activeView === 'mission' && selectedTask) {
      return `I've identified <strong>${selectedTask.relevantFiles.length} files</strong> relevant to "${selectedTask.name}" and flagged <strong>${selectedTask.knownTraps.length} known traps</strong>. Start with the prerequisites before touching any code.`
    }
    if (activeView === 'hotspots') {
      return `This codebase has <strong>3 high-risk modules</strong>. The auth middleware (<strong>risk 9.2</strong>) is the most critical — it has caused 3 production incidents.`
    }
    if (activeView === 'onboarding') {
      return `Choose your role and I'll create a <strong>personalized learning path</strong> through this codebase. Each lesson focuses on what matters most for your work.`
    }
    if (activeView === 'map') {
      return `This is the <strong>architecture map</strong> of ${data.repo.name}. Building height = lines of code. Color = risk level. Click any building for details.`
    }
    return 'Ready to help.'
  }

  if (isAnalyzing && !data) {
    return (
      <div className="dashboard">
        <Sidebar
          data={null}
          activeView={activeView}
          onViewChange={handleViewChange}
          selectedTask={selectedTask}
        />
        <div className="main">
          <div className="main__content">
            <div className="analyzing">
              <div className="analyzing__spinner" />
              <div className="analyzing__text">Analyzing repository...</div>
              <div className="analyzing__subtext">Scanning file structure, imports, and dependencies</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderView = () => {
    if (isAnalyzing) {
      return (
        <div className="analyzing">
          <div className="analyzing__spinner" />
          <div className="analyzing__text">Preparing your mission brief...</div>
          <div className="analyzing__subtext">Analyzing task scope, identifying relevant files, checking for known traps</div>
        </div>
      )
    }

    switch (activeView) {
      case 'task':
        return <TaskInput onSubmit={handleTaskSubmit} />
      case 'mission':
        return selectedTask ? <MissionBrief task={selectedTask} data={data} /> : <TaskInput onSubmit={handleTaskSubmit} />
      case 'onboarding':
        return <OnboardingView data={data} />
      case 'hotspots':
        return <HotspotsView data={data} />
      case 'map':
        return <MapView data={data} />
      default:
        return <TaskInput onSubmit={handleTaskSubmit} />
    }
  }

  return (
    <div className="dashboard">
      <Sidebar
        data={data}
        activeView={activeView}
        onViewChange={handleViewChange}
        selectedTask={selectedTask}
      />
      <div className="main">
        <div className="main__header">
          <h2 className="main__title">{VIEW_TITLES[activeView] || 'Atlas AI'}</h2>
        </div>
        <div className="main__content">
          {renderView()}
        </div>
        <AIBar message={getAIMessage()} />
      </div>
    </div>
  )
}
