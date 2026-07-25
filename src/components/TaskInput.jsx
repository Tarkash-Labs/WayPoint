import { useState } from 'react'

const EXAMPLE_TASKS = [
  'Add Google OAuth',
  'Fix login bug',
  'Add dark mode',
  'Improve performance',
]

export default function TaskInput({ onSubmit }) {
  const [task, setTask] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (task.trim()) {
      onSubmit(task.trim())
    }
  }

  const handleChipClick = (taskName) => {
    setTask(taskName)
    onSubmit(taskName)
  }

  return (
    <div className="task-input">
      <h2 className="task-input__heading">What are you trying to do?</h2>
      <p className="task-input__subheading">
        Describe your task and Waypoint will identify exactly which files, concepts, and risks you need to know about.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="task-input__field"
          placeholder="e.g., Add Google OAuth, Fix login bug, Refactor billing..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          autoFocus
        />
      </form>

      <div className="task-input__examples">
        <div className="task-input__examples-label">Try an example</div>
        <div className="task-input__chips">
          {EXAMPLE_TASKS.map((t) => (
            <button key={t} className="task-chip" onClick={() => handleChipClick(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
