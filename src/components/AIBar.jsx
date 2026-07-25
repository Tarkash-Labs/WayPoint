export default function AIBar({ message }) {
  return (
    <div className="hud-aibar">
      <div className="hud-aibar__avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M6 20v-2a6 6 0 0112 0v2"/>
        </svg>
      </div>
      <div className="hud-aibar__text" dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  )
}
