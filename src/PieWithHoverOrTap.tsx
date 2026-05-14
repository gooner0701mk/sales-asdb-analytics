import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

/** 円グラフ1スライス分（name / value 必須、その他はツールチップ用） */
export type PieSliceDatum = {
  name: string
  value: number
  [key: string]: unknown
}

type Props = {
  data: PieSliceDatum[]
  height: number
  colors: string[]
  /** `(hover: hover) and (pointer: fine)` が true のときホバーでツールチップ */
  isFinePointer: boolean
  tooltipContent: (props: Record<string, unknown>) => React.ReactNode
  /** タップ時パネル用の割合・補足行（なければ省略） */
  mobileFootnote: (datum: PieSliceDatum) => string | null
  formatYen: (n: number) => string
  cx?: string | number
  cy?: string | number
  innerRadius?: number | string
  outerRadius: number | string
  paddingAngle?: number
  isAnimationActive?: boolean | 'auto'
  legend?: ReactNode
  /** Cell の stroke（例: var(--surface)） */
  cellStroke?: string
  debounceMs?: number
  minWidth?: number
  wrapClassName?: string
  ariaLabel?: string
}

export function PieWithHoverOrTap({
  data,
  height,
  colors,
  isFinePointer,
  tooltipContent,
  mobileFootnote,
  formatYen,
  cx = '50%',
  cy = '50%',
  innerRadius = 0,
  outerRadius,
  paddingAngle = 1,
  isAnimationActive = false,
  legend,
  cellStroke,
  debounceMs = 80,
  minWidth = 0,
  wrapClassName,
  ariaLabel,
}: Props) {
  const [mobileIndex, setMobileIndex] = useState<number | null>(null)

  useEffect(() => {
    setMobileIndex(null)
  }, [data])

  const activateSector = useCallback((_d: unknown, index: number) => {
    if (isFinePointer) return
    setMobileIndex(index)
  }, [isFinePointer])

  const closeMobile = useCallback(() => {
    setMobileIndex(null)
  }, [])

  const mobileDatum =
    !isFinePointer && mobileIndex !== null && data[mobileIndex] != null
      ? data[mobileIndex]
      : null
  const mobileFoot = mobileDatum ? mobileFootnote(mobileDatum) : null

  return (
    <div className={`pie-hover-tap-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`} aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height} debounce={debounceMs} minWidth={minWidth}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={paddingAngle}
            isAnimationActive={isAnimationActive}
            {...(!isFinePointer
              ? {
                  onClick: activateSector,
                  onTouchEnd: activateSector,
                }
              : {})}
          >
            {data.map((_, i) => (
              <Cell
                key={`pie-cell-${i}`}
                fill={colors[i % colors.length]}
                stroke={cellStroke}
                strokeWidth={cellStroke ? 1 : undefined}
              />
            ))}
          </Pie>
          {isFinePointer ? (
            <Tooltip content={tooltipContent} trigger="hover" />
          ) : null}
          {legend}
        </PieChart>
      </ResponsiveContainer>
      {!isFinePointer && mobileDatum ? (
        <div className="pie-mobile-touch-panel" role="region" aria-live="polite">
          <div className="pie-mobile-touch-panel-row">
            <strong className="pie-mobile-touch-panel-name">{mobileDatum.name}</strong>
            <button type="button" className="pie-mobile-touch-panel-close" onClick={closeMobile}>
              閉じる
            </button>
          </div>
          <div className="pie-mobile-touch-panel-yen">{formatYen(mobileDatum.value)}</div>
          {mobileFoot ? (
            <div className="muted small pie-mobile-touch-panel-foot">{mobileFoot}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
