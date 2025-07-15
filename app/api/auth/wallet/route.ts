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

    // Check if user already exists by wallet address
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

      // Use consistent email format for wallet users
      const walletEmail = `${address.toLowerCase()}@wallet.local`

      // Create user in auth.users table
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: walletEmail,
          password: address.toLowerCase() + "_WALLET_2024", // 使用固定密码格式
          email_confirm: true
        })

      if (authError) {
        console.error("Error creating auth user:", authError)
        return NextResponse.json(
          {
            error: "Failed to create user account",
            code: authError.code,
            status: authError.status,
            message: authError.message,
            name: authError.name
          },
          { status: 500 }
        )
      }

      if (!authUser || !authUser.user) {
        console.error("No user returned from createUser:", authUser)
        return NextResponse.json(
          { error: "Failed to create user account (no user returned)" },
          { status: 500 }
        )
      }

      userId = authUser.user.id

      // Update the auto-created profile with wallet address, username, and display name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: `user_${address.slice(0, 8)}`,
          display_name: `User ${address.slice(0, 6)}...`,
          wallet_address: address.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        return NextResponse.json(
          { error: "Failed to update user profile" },
          { status: 500 }
        )
      }

      // Get the home workspace (should be auto-created by trigger)
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

      // Initialize user points manually
      const { error: pointsError } = await supabase.from("user_points").insert({
        user_id: userId,
        points: 0
      })

      if (pointsError) {
        console.error("Error initializing user points:", pointsError)
        // Don't fail the registration, just log the error
      }

      // For new users, return login credentials
      return NextResponse.json({
        success: true,
        isNewUser: true,
        workspaceId: workspace.id,
        email: walletEmail,
        password: address.toLowerCase() + "_WALLET_2024"
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
