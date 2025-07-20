import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Tables } from "@/supabase/types"

export async function getUserPoints(userId: string) {
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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
  const supabase = createClient(cookies())
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

// 新增：确保用户积分记录存在，如果不存在则创建
export async function ensureUserPointsRecord(userId: string) {
  const supabase = createClient(cookies())

  // 首先尝试获取现有记录
  let { data: pointsData, error: pointsError } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .single()

  // 如果记录不存在，创建一个新的
  if (pointsError && pointsError.code === "PGRST116") {
    const { data: newPointsData, error: insertError } = await supabase
      .from("user_points")
      .insert({
        user_id: userId,
        points: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating user points record:", insertError)
      throw new Error("Failed to create points record")
    }

    return newPointsData
  } else if (pointsError) {
    console.error("Error fetching user points:", pointsError)
    throw new Error("Failed to fetch points")
  }

  return pointsData
}

// 新增：并行获取所有积分相关数据
export async function getAllPointsData(userId: string, recordLimit = 30) {
  try {
    // 并行执行所有查询
    const [pointsData, checkInData, firstConversationData, imageShareData] =
      await Promise.all([
        ensureUserPointsRecord(userId),
        getCheckInRecords(userId, recordLimit),
        getDailyFirstConversationRecords(userId, recordLimit),
        getImageShareXRecords(userId, recordLimit)
      ])

    return {
      points: pointsData,
      check_in_records: checkInData || [],
      first_conversation_records: firstConversationData || [],
      image_share_records: imageShareData || []
    }
  } catch (error) {
    console.error("Error fetching all points data:", error)
    throw error
  }
}
