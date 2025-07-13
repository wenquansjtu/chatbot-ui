import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    // Perform check-in
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
