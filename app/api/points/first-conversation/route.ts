import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ensureUserPointsRecord } from "@/db/points"

export async function POST(request: Request) {
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

    // Get request body
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      )
    }

    // 确保用户有积分记录（使用新的辅助函数）
    await ensureUserPointsRecord(user.id)

    // Perform first conversation bonus check using database function
    const { data, error } = await supabase.rpc(
      "daily_first_conversation_bonus",
      {
        user_uuid: user.id,
        chat_uuid: chatId
      }
    )

    if (error) {
      console.error("First conversation bonus error:", error)
      return NextResponse.json(
        { error: "Failed to process first conversation bonus" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("First conversation route error:", error)

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

    // Check if already earned first conversation bonus today
    const today = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("daily_first_conversation_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("conversation_date", today)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking today's first conversation:", error)
      return NextResponse.json(
        { error: "Failed to check status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      earned_today: !!data,
      first_conversation_record: data
    })
  } catch (error) {
    console.error("First conversation status route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
