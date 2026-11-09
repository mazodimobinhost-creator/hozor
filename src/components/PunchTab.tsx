import { useState } from 'react'
import type { Settings } from '../lib/types'
import { PunchScreen } from './PunchScreen'
import { ManualEntryScreen } from './ManualEntryScreen'
import { Icon } from './Icons'

type Mode = 'quick' | 'manual'

export function PunchTab({
  settings,
  onToast,
}: {
  settings: Settings
  onToast: (msg: string) => void
}) {
  const [mode, setMode] = useState<Mode>('manual')

  return (
    <div>
      <div className="month-bar" style={{ paddingBottom: 12 }}>
        <div>
          <div className="month-title">ثبت ورود و خروج</div>
          <div className="tiny muted">
            {mode === 'manual'
              ? 'روز و ساعت را خودتان دستی وارد کنید'
              : 'با یک دکمه، همین لحظه ثبت کنید'}
          </div>
        </div>
        <div className="spacer" />
        <div className="segmented" role="tablist">
          <button
            className={`seg-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
            role="tab"
            aria-selected={mode === 'manual'}
          >
            <Icon name="calendarCheck" size={15} /> ثبت دستی
          </button>
          <button
            className={`seg-btn ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => setMode('quick')}
            role="tab"
            aria-selected={mode === 'quick'}
          >
            <Icon name="clock" size={15} /> ثبت سریع
          </button>
        </div>
      </div>

      {mode === 'manual' ? (
        <ManualEntryScreen settings={settings} onToast={onToast} />
      ) : (
        <PunchScreen settings={settings} onToast={onToast} />
      )}
    </div>
  )
}
