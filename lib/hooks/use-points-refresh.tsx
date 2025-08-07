import { useCallback } from "react"

interface UsePointsRefreshProps {
  onPointsUpdate?: () => void
}

export const usePointsRefresh = ({
  onPointsUpdate
}: UsePointsRefreshProps = {}) => {
  // 获取积分数据的函数
  const fetchPointsData = useCallback(async () => {
    try {
      const response = await fetch("/api/points")
      if (response.ok) {
        const data = await response.json()
        console.log("Points data fetched:", data)
        return data
      }
    } catch (error) {
      console.error("Error fetching points data:", error)
      throw error
    }
  }, [])

  // 刷新积分数据并通知父组件的函数
  const refreshPointsAndNotify = useCallback(async () => {
    try {
      // 刷新数据
      await fetchPointsData()

      // 通知父组件刷新
      if (onPointsUpdate) {
        onPointsUpdate()
      }
    } catch (error) {
      console.error("Failed to refresh points:", error)
    }
  }, [fetchPointsData, onPointsUpdate])

  return {
    fetchPointsData,
    refreshPointsAndNotify
  }
}
