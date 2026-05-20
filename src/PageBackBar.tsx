type Props = {
  title: string
  onBack: () => void
}

export function PageBackBar({ title, onBack }: Props) {
  return (
    <div className="page-back-bar">
      <button type="button" className="page-back-btn" onClick={onBack}>
        <span className="page-back-arrow" aria-hidden>
          ←
        </span>
        トップに戻る
      </button>
      <h2 className="page-back-title">{title}</h2>
    </div>
  )
}
