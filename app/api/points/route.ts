import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    // Get user points
    let { data: pointsData, error: pointsError } = await supabase
      .from("user_points")
      .select("*")
      .eq("user_id", user.id)
      .single()

    // If user doesn't have a points record, create one
    if (pointsError && pointsError.code === "PGRST116") {
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

    // Get check-in records
    const { data: checkInData, error: checkInError } = await supabase
      .from("check_in_records")
      .select("*")
      .eq("user_id", user.id)
      .order("check_in_date", { ascending: false })
      .limit(30)

    if (checkInError) {
      console.error("Error fetching check-in records:", checkInError)
      return NextResponse.json(
        { error: "Failed to fetch check-in records" },
        { status: 500 }
      )
    }

    // Get daily first conversation records
    const { data: firstConversationData, error: firstConversationError } =
      await supabase
        .from("daily_first_conversation_records")
        .select("*")
        .eq("user_id", user.id)
        .order("conversation_date", { ascending: false })
        .limit(30)

    if (firstConversationError) {
      console.error(
        "Error fetching first conversation records:",
        firstConversationError
      )
      return NextResponse.json(
        { error: "Failed to fetch first conversation records" },
        { status: 500 }
      )
    }

    // Get image share X records
    const { data: imageShareData, error: imageShareError } = await supabase
      .from("image_share_x_records")
      .select("*")
      .eq("user_id", user.id)
      .order("share_date", { ascending: false })
      .limit(30)

    if (imageShareError) {
      console.error("Error fetching image share records:", imageShareError)
      return NextResponse.json(
        { error: "Failed to fetch image share records" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      points: pointsData,
      check_in_records: checkInData || [],
      first_conversation_records: firstConversationData || [],
      image_share_records: imageShareData || []
    })
  } catch (error) {
    console.error("Points route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
