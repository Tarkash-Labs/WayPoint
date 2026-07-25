import { useState } from 'react'

const EXAMPLE_TASKS = [
  'Fix Login Bug',
  'Add Google OAuth',
  'Refactor Billing API',
  'Improve Performance',
  'Update Dependencies',
]

export default function TaskInput({ onSubmit }) {
  const [task, setTask] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (task.trim()) onSubmit(task.trim())
  }

  const handleChipClick = (taskName) => {
    setTask(taskName)
    onSubmit(taskName)
  }

  return (
    <div className="hud-task">
      {/* Holographic Textarea */}
      <form onSubmit={handleSubmit} className="hud-task__form">
        <div className={`hud-task__textarea-wrap ${focused ? 'hud-task__textarea-wrap--focused' : ''}`}>
          <div className="hud-task__glow-border" />
          <textarea
            className="hud-task__textarea"
            placeholder="What are you trying to do?"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (task.trim()) onSubmit(task.trim())
              }
            }}
            autoFocus
            rows={4}
          />
          {/* Corner accents */}
          <span className="hud-task__corner hud-task__corner--tl" />
          <span className="hud-task__corner hud-task__corner--tr" />
          <span className="hud-task__corner hud-task__corner--bl" />
          <span className="hud-task__corner hud-task__corner--br" />
        </div>
      </form>

      {/* Suggestion Chips */}
      <div className="hud-task__chips">
        {EXAMPLE_TASKS.map((t) => (
          <button key={t} className="hud-task__chip" onClick={() => handleChipClick(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
