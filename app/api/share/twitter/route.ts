import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

// Twitter API配置
const TWITTER_API_V1_BASE = "https://upload.twitter.com/1.1"
const TWITTER_API_V2_BASE = "https://api.twitter.com/2"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // 验证用户身份
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { imageData, text, messageId } = await request.json()

    if (!imageData || !text) {
      return NextResponse.json(
        { error: "Image data and text are required" },
        { status: 400 }
      )
    }

    // 检查用户是否配置了Twitter API密钥
    const twitterApiKey = process.env.TWITTER_API_KEY
    const twitterApiSecret = process.env.TWITTER_API_SECRET
    const twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN
    const twitterAccessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

    if (
      !twitterApiKey ||
      !twitterApiSecret ||
      !twitterAccessToken ||
      !twitterAccessTokenSecret
    ) {
      return NextResponse.json(
        {
          error: "Twitter API credentials not configured",
          message: "请在环境变量中配置Twitter API密钥"
        },
        { status: 500 }
      )
    }

    try {
      // 第一步：上传图片到Twitter
      const mediaId = await uploadImageToTwitter(imageData, {
        apiKey: twitterApiKey,
        apiSecret: twitterApiSecret,
        accessToken: twitterAccessToken,
        accessTokenSecret: twitterAccessTokenSecret
      })

      // 第二步：发布推文附带图片
      const tweetId = await postTweetWithMedia(text, mediaId, {
        apiKey: twitterApiKey,
        apiSecret: twitterApiSecret,
        accessToken: twitterAccessToken,
        accessTokenSecret: twitterAccessTokenSecret
      })

      // 奖励积分（如果提供了messageId）
      if (messageId) {
        try {
          const response = await fetch(
            `${request.nextUrl.origin}/api/points/share-image-x`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("cookie") || ""
              },
              body: JSON.stringify({
                messageId: messageId,
                imagePath: ""
              })
            }
          )

          if (response.ok) {
            const pointsData = await response.json()
            return NextResponse.json({
              success: true,
              tweetId,
              tweetUrl: `https://twitter.com/user/status/${tweetId}`,
              pointsEarned: pointsData.points_earned || 0
            })
          }
        } catch (error) {
          console.error("Error awarding points:", error)
        }
      }

      return NextResponse.json({
        success: true,
        tweetId,
        tweetUrl: `https://twitter.com/user/status/${tweetId}`
      })
    } catch (error: any) {
      console.error("Twitter API error:", error)
      return NextResponse.json(
        {
          error: "Failed to post to Twitter",
          message: error.message || "Unknown error occurred"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Share to Twitter route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// 生成OAuth 1.0a签名
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // 简化的OAuth签名生成（实际项目中建议使用专门的OAuth库）
  const crypto = require("crypto")

  // 1. 收集参数
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&")

  // 2. 构建签名基字符串
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join("&")

  // 3. 构建签名密钥
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  // 4. 生成签名
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64")

  return signature
}

// 上传图片到Twitter API v1.1
async function uploadImageToTwitter(
  imageData: string,
  credentials: {
    apiKey: string
    apiSecret: string
    accessToken: string
    accessTokenSecret: string
  }
): Promise<string> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials

  // 将base64图片数据转换为Buffer
  const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "")
  const imageBuffer = Buffer.from(base64Data, "base64")

  // 准备OAuth参数
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: Math.random().toString(36).substring(2, 15),
    oauth_version: "1.0"
  }

  const url = `${TWITTER_API_V1_BASE}/media/upload.json`

  // 生成OAuth签名
  const signature = generateOAuthSignature(
    "POST",
    url,
    oauthParams,
    apiSecret,
    accessTokenSecret
  )
  oauthParams["oauth_signature"] = signature

  // 构建Authorization头
  const authHeader =
    "OAuth " +
    Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(", ")

  // 创建FormData
  const formData = new FormData()
  const blob = new Blob([imageBuffer], { type: "image/jpeg" })
  formData.append("media", blob)

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader
    },
    body: formData
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to upload image: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  return result.media_id_string
}

// 发布推文附带媒体（使用Twitter API v2）
async function postTweetWithMedia(
  text: string,
  mediaId: string,
  credentials: {
    apiKey: string
    apiSecret: string
    accessToken: string
    accessTokenSecret: string
  }
): Promise<string> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials

  // 准备OAuth参数
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: Math.random().toString(36).substring(2, 15),
    oauth_version: "1.0"
  }

  const url = `${TWITTER_API_V2_BASE}/tweets`

  // 生成OAuth签名
  const signature = generateOAuthSignature(
    "POST",
    url,
    oauthParams,
    apiSecret,
    accessTokenSecret
  )
  oauthParams["oauth_signature"] = signature

  // 构建Authorization头
  const authHeader =
    "OAuth " +
    Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(", ")

  const requestBody = {
    text: text,
    media: {
      media_ids: [mediaId]
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to post tweet: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  return result.data.id
}
