import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    // Ensure user has a points record
    let { data: pointsData, error: pointsError } = await supabase
      .from("user_points")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (pointsError && pointsError.code === "PGRST116") {
      // Create points record if it doesn't exist
      const { data: newPointsData, error: insertError } = await supabase
        .from("user_points")
        .insert({
          user_id: user.id,
          points: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating user points record:", insertError)
        return NextResponse.json(
          { error: "Failed to create points record" },
          { status: 500 }
        )
      }

      pointsData = newPointsData
    } else if (pointsError) {
      console.error("Error fetching user points:", pointsError)
      return NextResponse.json(
        { error: "Failed to fetch points" },
        { status: 500 }
      )
    }

    // Perform first conversation bonus check
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
        { error: "Failed to process bonus" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("First conversation bonus route error:", error)
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
