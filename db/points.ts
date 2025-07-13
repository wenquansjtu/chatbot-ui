import { supabase } from "@/lib/supabase/server"
import { Tables } from "@/supabase/types"

export async function getUserPoints(userId: string) {
  const { data, error } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error) {
    console.error("Error fetching user points:", error)
    return null
  }

  return data
}

export async function getCheckInRecords(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("check_in_records")
    .select("*")
    .eq("user_id", userId)
    .order("check_in_date", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching check-in records:", error)
    return []
  }

  return data
}

export async function checkIfTodayCheckedIn(userId: string) {
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("check_in_records")
    .select("*")
    .eq("user_id", userId)
    .eq("check_in_date", today)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found"
    console.error("Error checking today's check-in:", error)
    return null
  }

  return data
}

export async function performDailyCheckIn(userId: string) {
  // 使用数据库函数来处理打卡逻辑
  const { data, error } = await supabase.rpc("daily_check_in", {
    user_uuid: userId
  })

  if (error) {
    console.error("Error performing daily check-in:", error)
    return {
      success: false,
      message: "Failed to check in",
      points_earned: 0,
      total_points: 0
    }
  }

  return data
}

export async function getPointsHistory(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("check_in_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching points history:", error)
    return []
  }

  return data
}
