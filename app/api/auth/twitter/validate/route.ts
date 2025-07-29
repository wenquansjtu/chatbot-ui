import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: twitterAuth } = await supabase
      .from("user_twitter_auth")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!twitterAuth) {
      return NextResponse.json({
        connected: false,
        needsAuth: true
      })
    }

    // Test the token with a simple API call
    const testResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${twitterAuth.access_token}`
      }
    })

    if (testResponse.ok) {
      return NextResponse.json({
        connected: true,
        valid: true,
        screen_name: twitterAuth.screen_name
      })
    } else {
      // Token is invalid, clean it up
      await supabase.from("user_twitter_auth").delete().eq("user_id", user.id)

      return NextResponse.json({
        connected: false,
        valid: false,
        needsAuth: true
      })
    }
  } catch (error) {
    console.error("Twitter validation error:", error)
    return NextResponse.json({ error: "Validation failed" }, { status: 500 })
  }
}
