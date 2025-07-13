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
    const { messageId, imagePath } = await request.json()

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
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

    // Perform image share X bonus
    const { data, error } = await supabase.rpc("image_share_x_bonus", {
      user_uuid: user.id,
      message_uuid: messageId,
      image_path: imagePath || ""
    })

    if (error) {
      console.error("Image share X bonus error:", error)
      return NextResponse.json(
        { error: "Failed to process bonus" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Image share X bonus route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
