import { createClient } from "@supabase/supabase-js"
import { ethers } from "ethers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { address, signature, message } = await request.json()

    if (!address || !signature || !message) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    // Verify signature
    console.log("Verifying signature:", {
      address,
      signature,
      message
    })

    const recoveredAddress = ethers.utils.verifyMessage(message, signature)
    console.log("Recovered address:", recoveredAddress)

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      console.log("Address mismatch:", {
        recovered: recoveredAddress.toLowerCase(),
        provided: address.toLowerCase()
      })
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      )
    }

    // Create server-side Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user already exists
    const { data: existingUser, error: userError } = await supabase
      .from("profiles")
      .select("user_id, username")
      .eq("wallet_address", address.toLowerCase())
      .single()

    let isNewUser = false
    let userId: string

    if (userError && userError.code === "PGRST116") {
      // User doesn't exist, create new user
      isNewUser = true

      // Create user in auth.users table
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: `${address.toLowerCase()}@wallet.local`,
          password: address.toLowerCase(),
          email_confirm: true
        })

      if (authError) {
        console.error("Error creating auth user:", authError)
        return NextResponse.json(
          { error: "Failed to create user account" },
          { status: 500 }
        )
      }

      userId = authUser.user.id

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: userId,
        username: `user_${address.slice(0, 8)}`,
        wallet_address: address.toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      if (profileError) {
        console.error("Error creating profile:", profileError)
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        )
      }

      // Create home workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          user_id: userId,
          name: "Home",
          is_home: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (workspaceError) {
        console.error("Error creating workspace:", workspaceError)
        return NextResponse.json(
          { error: "Failed to create workspace" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        isNewUser: true,
        workspaceId: workspace.id
      })
    } else if (userError) {
      console.error("Error checking existing user:", userError)
      return NextResponse.json(
        { error: "Failed to check user existence" },
        { status: 500 }
      )
    } else {
      // User exists, get their workspace
      userId = existingUser.user_id

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", userId)
        .eq("is_home", true)
        .single()

      if (workspaceError) {
        console.error("Error fetching workspace:", workspaceError)
        return NextResponse.json(
          { error: "Failed to fetch user workspace" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        isNewUser: false,
        workspaceId: workspace.id
      })
    }
  } catch (error: any) {
    console.error("Wallet auth error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
