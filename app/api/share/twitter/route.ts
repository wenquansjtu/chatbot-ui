import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import crypto from "crypto"

export async function POST(request: Request) {
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

    // 获取用户的Twitter凭证
    const { data: twitterAuth } = await supabase
      .from("user_twitter_auth")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!twitterAuth) {
      return NextResponse.json(
        {
          error: "Twitter not connected",
          needsAuth: true,
          authUrl: `/api/auth/twitter?action=request_token`
        },
        { status: 401 }
      )
    }

    const { imageData, text, messageId } = await request.json()

    try {
      // 使用用户的Twitter凭证发布推文
      const mediaId = await uploadImageToTwitter(imageData, {
        consumerKey: process.env.TWITTER_API_KEY!,
        consumerSecret: process.env.TWITTER_API_SECRET!,
        accessToken: twitterAuth.access_token,
        accessTokenSecret: twitterAuth.access_token_secret
      })

      const tweetId = await postTweetWithMedia(text, mediaId, {
        consumerKey: process.env.TWITTER_API_KEY!,
        consumerSecret: process.env.TWITTER_API_SECRET!,
        accessToken: twitterAuth.access_token,
        accessTokenSecret: twitterAuth.access_token_secret
      })

      // 奖励积分
      if (messageId && messageId !== "general-share") {
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/points/share-image-x`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId })
          }
        )
      }

      return NextResponse.json({
        success: true,
        tweetId,
        tweetUrl: `https://twitter.com/${twitterAuth.screen_name}/status/${tweetId}`,
        pointsEarned: messageId !== "general-share" ? 200 : 100
      })
    } catch (error: any) {
      console.error("Twitter API error:", error)

      // 如果是401错误，可能需要重新认证
      if (error.message.includes("401")) {
        // 删除无效的token
        await supabase.from("user_twitter_auth").delete().eq("user_id", user.id)

        return NextResponse.json(
          {
            error: "Twitter authentication expired",
            needsAuth: true,
            authUrl: `/api/auth/twitter?action=request_token`,
            message: "请重新连接Twitter账户"
          },
          { status: 401 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error("Twitter share error:", error)
    return NextResponse.json(
      { error: "Failed to share to Twitter" },
      { status: 500 }
    )
  }
}

// OAuth签名生成函数
function generateOAuthSignature(
  method: string,
  url: string,
  params: any,
  consumerSecret: string,
  tokenSecret: string
) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&")

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join("&")

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  return crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64")
}

// 使用用户凭证上传图片到Twitter
async function uploadImageToTwitter(imageData: string, credentials: any) {
  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json"

  // 将base64图片数据转换为Buffer
  const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "")
  const imageBuffer = Buffer.from(base64Data, "base64")

  const oauthParams = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
    oauth_signature: "" // 先设置为空字符串
  }

  // 生成OAuth签名
  const signature = generateOAuthSignature(
    "POST",
    uploadUrl,
    oauthParams,
    credentials.consumerSecret,
    credentials.accessTokenSecret
  )
  oauthParams.oauth_signature = signature

  const authHeader =
    "OAuth " +
    Object.entries(oauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(", ")

  // 创建FormData
  const formData = new FormData()
  formData.append("media", new Blob([imageBuffer], { type: "image/png" }))

  const response = await fetch(uploadUrl, {
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

// 使用用户凭证发布推文
async function postTweetWithMedia(
  text: string,
  mediaId: string,
  credentials: any
) {
  const tweetUrl = "https://api.twitter.com/2/tweets"

  const oauthParams = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
    oauth_signature: "" // 先设置为空字符串
  }

  // 生成OAuth签名
  const signature = generateOAuthSignature(
    "POST",
    tweetUrl,
    oauthParams,
    credentials.consumerSecret,
    credentials.accessTokenSecret
  )
  oauthParams.oauth_signature = signature

  const authHeader =
    "OAuth " +
    Object.entries(oauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(", ")

  const tweetData = {
    text: text,
    media: {
      media_ids: [mediaId]
    }
  }

  const response = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tweetData)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to post tweet: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  return result.data.id
}
