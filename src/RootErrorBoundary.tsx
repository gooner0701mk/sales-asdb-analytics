import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

/** 描画エラーで真っ白にならないようにする */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RootErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '1.5rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#fef2f2',
            color: '#450a0a',
          }}
        >
          <h1 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>
            画面の表示中にエラーが発生しました
          </h1>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', lineHeight: 1.55 }}>
            ブラウザを更新するか、別のブラウザで開いてください。古い iPhone / iPad
            の場合は OS を最新に近づけると改善することがあります。
          </p>
          <pre
            style={{
              fontSize: '0.75rem',
              overflow: 'auto',
              padding: '0.75rem',
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: 8,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
