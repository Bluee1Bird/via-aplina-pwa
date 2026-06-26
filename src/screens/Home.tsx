import { Link, useNavigate } from 'react-router-dom'
import { useStages } from '../hooks/useStages'
import { useProgress } from '../hooks/useProgress'

export default function Home() {
  const { stages, loading } = useStages()
  const { completedStages, currentStage, completedCount, allDone, toggleStage, markNextDone } = useProgress(stages)
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <span className="text-5xl">🏔️</span>
        <h1 className="text-xl font-semibold text-neutral-800">No data loaded</h1>
        <p className="text-neutral-500 text-sm">Upload your stage CSV to get started.</p>
        <Link
          to="/settings"
          className="mt-2 px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-medium"
        >
          Go to Settings
        </Link>
      </div>
    )
  }

  const totalKm = stages.reduce((s, st) => s + st.length_km, 0)
  const totalGain = stages.reduce((s, st) => s + st.elevation_gain_m, 0)
  const remaining = stages.length - completedCount

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-12 pb-4 bg-white border-b border-neutral-200">
        <h1 className="text-lg font-semibold text-neutral-800">Via Alpina</h1>
        <Link to="/settings" className="p-2 text-neutral-500" aria-label="Settings">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Progress */}
        <div className="bg-white px-4 pt-4 pb-5 border-b border-neutral-200">
          <div className="flex justify-between text-sm text-neutral-500 mb-2">
            <span>{completedCount} of {stages.length} stages done</span>
            <span>{Math.round((completedCount / stages.length) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / stages.length) * 100}%` }}
            />
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-3">
            <Stat label="Total km" value={`${totalKm.toFixed(0)} km`} />
            <Stat label="Total gain" value={`+${totalGain.toLocaleString()} m`} />
            <Stat label="Remaining" value={`${remaining} days`} />
          </div>
        </div>

        {/* Stage list */}
        <ul className="divide-y divide-neutral-200">
          {stages.map(stage => {
            const done = completedStages.has(stage.stage)
            const isCurrent = currentStage?.stage === stage.stage

            return (
              <li key={stage.stage} className="flex items-center bg-white">
                {/* Tappable done toggle */}
                <button
                  onClick={() => toggleStage(stage.stage)}
                  aria-label={done ? `Unmark stage ${stage.stage} as done` : `Mark stage ${stage.stage} as done`}
                  className="pl-4 pr-2 py-4 shrink-0 touch-manipulation"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    done
                      ? 'bg-green-600 text-white'
                      : isCurrent
                        ? 'border-2 border-green-600 text-green-700'
                        : 'border-2 border-neutral-300 text-neutral-400'
                  }`}>
                    {done ? '✓' : stage.stage}
                  </div>
                </button>

                {/* Stage row — taps to DayCard */}
                <button
                  onClick={() => navigate(`/stage/${stage.stage}`)}
                  className={`flex-1 min-w-0 text-left py-3.5 pr-4 flex items-center gap-2 ${isCurrent ? 'bg-green-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${done ? 'text-neutral-400' : 'text-neutral-800'}`}>
                      {stage.start} → {stage.finish}
                    </div>
                    <div className={`text-xs mt-0.5 ${done ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      {stage.date} · {stage.length_km} km · +{stage.elevation_gain_m} m
                    </div>
                  </div>

                  {isCurrent && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                      Next
                    </span>
                  )}

                  <svg className="w-4 h-4 text-neutral-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bottom action */}
      {!allDone && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4 safe-area-bottom">
          <button
            onClick={markNextDone}
            className="w-full py-3.5 bg-green-700 text-white rounded-xl font-medium text-sm active:bg-green-800 transition-colors"
          >
            Mark today as done
          </button>
        </div>
      )}
      {allDone && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4">
          <p className="text-center text-sm text-green-700 font-medium">🎉 Hike complete!</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 bg-neutral-50 rounded-xl px-3 py-2.5 border border-neutral-200">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-sm font-semibold text-neutral-800 mt-0.5">{value}</div>
    </div>
  )
}
