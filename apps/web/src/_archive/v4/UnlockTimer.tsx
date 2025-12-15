// UnlockTimer.tsx - Shows countdown for locked AMM positions
import { useEffect, useState } from 'react'

interface UnlockTimerProps {
    unlockTime: number // Unix timestamp
}

export function UnlockTimer({ unlockTime }: UnlockTimerProps) {
    const [timeRemaining, setTimeRemaining] = useState(0)

    useEffect(() => {
        const updateTimer = () => {
            const remaining = unlockTime - Date.now() / 1000
            setTimeRemaining(remaining > 0 ? remaining : 0)
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [unlockTime])

    if (timeRemaining === 0) {
        return (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded text-center">
                <span className="text-sm text-green-800 dark:text-green-200">
                    🔓 Unlocked! Ready to sell
                </span>
            </div>
        )
    }

    const hours = Math.floor(timeRemaining / 3600)
    const minutes = Math.floor((timeRemaining % 3600) / 60)
    const seconds = Math.floor(timeRemaining % 60)

    return (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
            <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    🔒 Position Locked
                </span>
                <span className="font-mono text-sm text-yellow-900 dark:text-yellow-100">
                    {hours}h {minutes}m {seconds}s
                </span>
            </div>
        </div>
    )
}
