import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** 画面に出す見出し（このセクションの名前） */
  title: string
}

type State = {
  error: Error | null
}

/**
 * 一部のチャート／集計 UI がランタイム例外を出しても、アプリ全体を白画面にしない。
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SectionErrorBoundary]', this.props.title, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="panel invoice-rankings-section" aria-label={this.props.title}>
          <h2 className="user-compare-title">{this.props.title}</h2>
          <p className="hint">
            このブロックの表示中にエラーが発生しました。他のタブ・グラフはそのまま使えます。
          </p>
          <pre
            className="invoice-rankings-error-pre"
            style={{
              fontSize: '0.75rem',
              padding: '0.5rem',
              background: 'var(--code-bg)',
              borderRadius: 6,
              overflow: 'auto',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="btn small"
            style={{ marginTop: '0.75rem' }}
            onClick={() => this.setState({ error: null })}
          >
            再表示を試す
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
