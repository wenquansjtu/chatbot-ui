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

    // Get all messages for the user
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("model_usage")
      .eq("user_id", user.id)
      .not("model_usage", "is", null)

    if (messagesError) {
      console.error("Error fetching messages:", messagesError)
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      )
    }

    // Calculate total cost from all messages
    let totalCost = 0

    messages?.forEach(message => {
      if (message.model_usage) {
        try {
          // Handle different formats of model_usage
          let usageData = message.model_usage

          // If it's a string, try to parse it
          if (typeof usageData === "string") {
            usageData = JSON.parse(usageData)
          }

          // If it's an array, process each item
          if (Array.isArray(usageData)) {
            usageData.forEach(usage => {
              if (usage && typeof usage === "object") {
                // Check for distributedModels first
                if (
                  usage.distributedModels &&
                  Array.isArray(usage.distributedModels)
                ) {
                  usage.distributedModels.forEach((distributedUsage: any) => {
                    if (
                      distributedUsage.cost &&
                      typeof distributedUsage.cost === "number"
                    ) {
                      totalCost += distributedUsage.cost
                    }
                  })
                } else if (usage.cost && typeof usage.cost === "number") {
                  totalCost += usage.cost
                }
              }
            })
          } else if (usageData && typeof usageData === "object") {
            // Single usage object
            if (
              usageData.distributedModels &&
              Array.isArray(usageData.distributedModels)
            ) {
              usageData.distributedModels.forEach((distributedUsage: any) => {
                if (
                  distributedUsage.cost &&
                  typeof distributedUsage.cost === "number"
                ) {
                  totalCost += distributedUsage.cost
                }
              })
            } else if (usageData.cost && typeof usageData.cost === "number") {
              totalCost += usageData.cost
            }
          }
        } catch (error) {
          console.error("Error parsing model_usage:", error)
        }
      }
    })

    return NextResponse.json({
      totalCost: totalCost,
      totalCostFormatted: totalCost.toFixed(4)
    })
  } catch (error) {
    console.error("Total usage route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
