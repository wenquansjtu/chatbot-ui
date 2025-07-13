"use client"

import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { IconCoins, IconTrophy } from "@tabler/icons-react"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../ui/dialog"
import { CheckInCard } from "./check-in-card"

interface PointsDisplayProps {
  className?: string
}

export const PointsDisplay: FC<PointsDisplayProps> = ({ className }) => {
  const { profile } = useContext(ChatbotUIContext)
  const [points, setPoints] = useState<number>(0)
  const [checkInStreak, setCheckInStreak] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Fetch user points
  const fetchPointsData = async () => {
    if (!profile) return

    try {
      const response = await fetch("/api/points")
      if (response.ok) {
        const data = await response.json()
        setPoints(data.points?.points || 0)

        // Calculate consecutive check-in days
        calculateStreak(data.check_in_records || [])
      }
    } catch (error) {
      console.error("Error fetching points data:", error)
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

  useEffect(() => {
    if (profile) {
      fetchPointsData()
    }
  }, [profile])

  // 当对话框打开时刷新数据
  useEffect(() => {
    if (isDialogOpen && profile) {
      fetchPointsData()
    }
  }, [isDialogOpen, profile])

  // 如果用户未登录，不显示积分组件
  if (!profile) return null

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${className}`}
        >
          <IconCoins className="size-4 text-yellow-500" />
          <span className="font-medium">{points.toLocaleString()}</span>
          {checkInStreak > 0 && (
            <div className="flex items-center gap-1">
              <IconTrophy className="size-3 text-blue-500" />
              <span className="text-xs text-blue-600">{checkInStreak}</span>
            </div>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCoins className="size-5 text-yellow-500" />
            Points System
          </DialogTitle>
        </DialogHeader>
        <CheckInCard onPointsUpdate={fetchPointsData} />
      </DialogContent>
    </Dialog>
  )
}
