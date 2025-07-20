import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ensureUserPointsRecord } from "@/db/points"

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Get current user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 确保用户有积分记录（使用新的辅助函数）
    await ensureUserPointsRecord(user.id)

    // Perform check-in using database function
    const { data, error } = await supabase.rpc("daily_check_in", {
      user_uuid: user.id
    })

    if (error) {
      console.error("Check-in error:", error)
      return NextResponse.json({ error: "Failed to check in" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Check-in route error:", error)

    // 根据错误类型返回不同的响应
    if (error instanceof Error && error.message.includes("Failed to")) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Get current user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if already checked in today
    const today = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("check_in_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("check_in_date", today)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking today's check-in:", error)
      return NextResponse.json(
        { error: "Failed to check status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      checked_in_today: !!data,
      check_in_record: data
    })
  } catch (error) {
    console.error("Check-in status route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
