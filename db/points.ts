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

// 新增：检查今天是否已经获得第一次对话奖励
export async function checkIfTodayFirstConversationEarned(userId: string) {
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("daily_first_conversation_records")
    .select("*")
    .eq("user_id", userId)
    .eq("conversation_date", today)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found"
    console.error("Error checking today's first conversation:", error)
    return null
  }

  return data
}

// 新增：执行每日第一次对话奖励
export async function performDailyFirstConversationBonus(
  userId: string,
  chatId: string
) {
  // 使用数据库函数来处理第一次对话奖励逻辑
  const { data, error } = await supabase.rpc("daily_first_conversation_bonus", {
    user_uuid: userId,
    chat_uuid: chatId
  })

  if (error) {
    console.error("Error performing daily first conversation bonus:", error)
    return {
      success: false,
      message: "Failed to process first conversation bonus",
      points_earned: 0,
      total_points: 0
    }
  }

  return data
}

// 新增：执行图片分享到X奖励
export async function performImageShareXBonus(
  userId: string,
  messageId: string,
  imagePath?: string
) {
  // 使用数据库函数来处理图片分享到X奖励逻辑
  const { data, error } = await supabase.rpc("image_share_x_bonus", {
    user_uuid: userId,
    message_uuid: messageId,
    image_path: imagePath || ""
  })

  if (error) {
    console.error("Error performing image share X bonus:", error)
    return {
      success: false,
      message: "Failed to process image share bonus",
      points_earned: 0,
      total_points: 0
    }
  }

  return data
}

// 新增：获取每日第一次对话记录
export async function getDailyFirstConversationRecords(
  userId: string,
  limit = 30
) {
  const { data, error } = await supabase
    .from("daily_first_conversation_records")
    .select("*")
    .eq("user_id", userId)
    .order("conversation_date", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching daily first conversation records:", error)
    return []
  }

  return data
}

// 新增：获取图片分享到X记录
export async function getImageShareXRecords(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("image_share_x_records")
    .select("*")
    .eq("user_id", userId)
    .order("share_date", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching image share X records:", error)
    return []
  }

  return data
}
