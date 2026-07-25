export default function AIBar({ message }) {
  return (
    <div className="ai-bar">
      <div className="ai-bar__icon">🧠</div>
      <div className="ai-bar__text" dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  )
}
