export default function AIBar({ message }) {
  return (
    <div className="ai-bar">
      <div className="ai-bar__icon"><i className="bx bx-brain" /></div>
      <div className="ai-bar__text" dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  )
}
