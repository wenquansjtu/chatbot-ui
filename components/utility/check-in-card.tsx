import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import {
  IconCalendar,
  IconCheck,
  IconCoins,
  IconMessage,
  IconShare,
  IconTrophy
} from "@tabler/icons-react"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../ui/card"
import { toast } from "sonner"

interface CheckInCardProps {
  onPointsUpdate?: () => void
}

export const CheckInCard: FC<CheckInCardProps> = ({ onPointsUpdate }) => {
  const { profile } = useContext(ChatbotUIContext)
  const [points, setPoints] = useState<number>(0)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [checkInStreak, setCheckInStreak] = useState(0)
  const [checkInRecords, setCheckInRecords] = useState<
    Tables<"check_in_records">[]
  >([])

  // Fetch user points and check-in status
  const fetchPointsData = async () => {
    if (!profile) return

    try {
      const response = await fetch("/api/points")
      if (response.ok) {
        const data = await response.json()
        setPoints(data.points?.points || 0)
        setCheckInRecords(data.check_in_records || [])

        // Calculate consecutive check-in days
        calculateStreak(data.check_in_records || [])
      }
    } catch (error) {
      console.error("Error fetching points data:", error)
    }
  }

  // Check if already checked in today
  const checkTodayStatus = async () => {
    if (!profile) return

    try {
      const response = await fetch("/api/points/check-in")
      if (response.ok) {
        const data = await response.json()
        setCheckedInToday(data.checked_in_today)
      }
    } catch (error) {
      console.error("Error checking today status:", error)
    }
  }

  // Calculate consecutive check-in days
  const calculateStreak = (records: Tables<"check_in_records">[]) => {
    if (records.length === 0) {
      setCheckInStreak(0)
      return
    }

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < records.length; i++) {
      const recordDate = new Date(records[i].check_in_date)
      recordDate.setHours(0, 0, 0, 0)

      const expectedDate = new Date(today)
      expectedDate.setDate(today.getDate() - i)

      if (recordDate.getTime() === expectedDate.getTime()) {
        streak++
      } else {
        break
      }
    }

    setCheckInStreak(streak)
  }

  // Perform check-in
  const handleCheckIn = async () => {
    if (!profile || checkedInToday || isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/points/check-in", {
        method: "POST"
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPoints(data.total_points)
          setCheckedInToday(true)
          toast.success(
            `Check-in successful! Earned ${data.points_earned} points`
          )

          // Refresh data
          await fetchPointsData()

          // Notify parent component to refresh
          if (onPointsUpdate) {
            onPointsUpdate()
          }
        } else {
          toast.error(data.message || "Check-in failed")
        }
      } else {
        toast.error("Check-in failed, please try again later")
      }
    } catch (error) {
      console.error("Error checking in:", error)
      toast.error("Check-in failed, please try again later")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      fetchPointsData()
      checkTodayStatus()
    }
  }, [profile])

  if (!profile) return null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCoins className="size-5 text-yellow-500" />
          Points System
        </CardTitle>
        <CardDescription>
          Earn points through daily activities and unlock more features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Points display */}
        <div className="flex items-center justify-between rounded-lg border bg-gradient-to-r from-yellow-50 to-orange-50 p-3">
          <div className="flex items-center gap-2">
            <IconCoins className="size-6 text-yellow-600" />
            <span className="text-lg font-semibold">Current Points</span>
          </div>
          <span className="text-2xl font-bold text-yellow-600">
            {points.toLocaleString()}
          </span>
        </div>

        {/* Check-in streak */}
        <div className="flex items-center justify-between rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 p-3">
          <div className="flex items-center gap-2">
            <IconTrophy className="size-6 text-blue-600" />
            <span className="text-lg font-semibold">Check-in Streak</span>
          </div>
          <span className="text-2xl font-bold text-blue-600">
            {checkInStreak} days
          </span>
        </div>

        {/* Check-in button */}
        <div className="space-y-2">
          <Button
            onClick={handleCheckIn}
            disabled={checkedInToday || isLoading}
            className={`h-12 w-full text-lg font-semibold ${
              checkedInToday
                ? "border-green-200 bg-green-100 text-green-700"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="size-5 animate-spin rounded-full border-b-2 border-white"></div>
                Checking in...
              </div>
            ) : checkedInToday ? (
              <div className="flex items-center gap-2">
                <IconCheck className="size-5" />
                Checked In Today
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <IconCalendar className="size-5" />
                Daily Check-in +100 Points
              </div>
            )}
          </Button>

          {checkedInToday && (
            <p className="text-center text-sm text-green-600">
              ✓ Earned 100 points today
            </p>
          )}
        </div>

        {/* Points earning rules */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            How to Earn Points
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded bg-green-50 p-2">
              <div className="flex items-center gap-2">
                <IconCalendar className="size-4 text-green-600" />
                <span className="text-gray-700">Daily Check-in</span>
              </div>
              <span className="font-medium text-green-600">+100 points</span>
            </div>
            <div className="flex items-center justify-between rounded bg-blue-50 p-2">
              <div className="flex items-center gap-2">
                <IconMessage className="size-4 text-blue-600" />
                <span className="text-gray-700">First Daily Conversation</span>
              </div>
              <span className="font-medium text-blue-600">+100 points</span>
            </div>
            <div className="flex items-center justify-between rounded bg-purple-50 p-2">
              <div className="flex items-center gap-2">
                <IconShare className="size-4 text-purple-600" />
                <span className="text-gray-700">Share Image to X</span>
              </div>
              <span className="font-medium text-purple-600">+200 points</span>
            </div>
          </div>
        </div>

        {/* Recent check-in records */}
        {checkInRecords.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">
              Recent Check-in Records
            </h4>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {checkInRecords.slice(0, 5).map((record, index) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm"
                >
                  <span className="text-gray-600">
                    {new Date(record.check_in_date).toLocaleDateString("en-US")}
                  </span>
                  <span className="font-medium text-green-600">
                    +{record.points_earned} points
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
