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
      console.log("🚀 开始Twitter分享流程")
      console.log("📊 请求数据:", {
        imageDataLength: imageData?.length,
        text,
        messageId
      })

      // 定义凭证对象
      const credentials = {
        consumerKey: process.env.TWITTER_API_KEY!,
        consumerSecret: process.env.TWITTER_API_SECRET!,
        accessToken: twitterAuth.access_token,
        accessTokenSecret: twitterAuth.access_token_secret
      }

      // 步骤1: 上传图片
      console.log("📸 开始上传图片...")
      const mediaId = await uploadImageToTwitter(imageData, credentials)
      console.log("✅ 图片上传成功:", { mediaId })

      // 步骤2: 发布推文
      console.log("🐦 开始发布推文...")
      const tweetId = await postTweetWithMedia(text, mediaId, credentials)
      console.log("✅ 推文发布成功:", { tweetId })

      // 步骤3: 奖励积分
      console.log("🏆 开始奖励积分...")
      if (messageId && messageId !== "general-share") {
        const pointsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/points/share-image-x`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId })
          }
        )
        console.log("✅ 积分奖励结果:", { status: pointsResponse.status })
      }

      console.log("🎉 Twitter分享流程完成")

      return NextResponse.json({
        success: true,
        tweetId,
        tweetUrl: `https://twitter.com/${twitterAuth.screen_name}/status/${tweetId}`,
        pointsEarned: messageId !== "general-share" ? 200 : 100
      })
    } catch (error: any) {
      console.error("Twitter API error:", error)

      // Enhanced error detection
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("Invalid or expired token")
      ) {
        // Log the expiration for monitoring
        console.log(
          `Twitter token expired for user ${user.id} at ${new Date().toISOString()}`
        )

        // Delete invalid token
        await supabase.from("user_twitter_auth").delete().eq("user_id", user.id)

        return NextResponse.json(
          {
            error: "Twitter authentication expired",
            needsAuth: true,
            authUrl: `/api/auth/twitter?action=request_token`,
            message:
              "Your Twitter connection has expired. Please reconnect your account.",
            timestamp: new Date().toISOString()
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

// 使用用户凭证上传图片到Twitter
async function uploadImageToTwitter(imageData: string, credentials: any) {
  try {
    console.log("📸 开始图片上传流程")

    // 检查图片数据
    if (!imageData || !imageData.startsWith("data:image/")) {
      throw new Error(`无效的图片数据格式: ${imageData?.substring(0, 50)}...`)
    }

    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json"
    console.log("🔗 上传URL:", uploadUrl)

    // Base64解析
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "")
    const imageBuffer = Buffer.from(base64Data, "base64")
    console.log("📊 图片信息:", {
      bufferSize: imageBuffer.length,
      base64Length: base64Data.length
    })

    // OAuth参数生成 - 修复时间戳问题
    const oauthParams: any = {
      oauth_consumer_key: credentials.consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(), // 确保使用正确的当前时间戳
      oauth_token: credentials.accessToken,
      oauth_version: "1.0"
    }

    console.log("🔐 OAuth参数（签名前）:", oauthParams)

    // 签名生成 - 确保不包含oauth_signature参数
    const signature = generateOAuthSignature(
      "POST",
      uploadUrl,
      oauthParams, // 这里不应该包含oauth_signature
      credentials.consumerSecret,
      credentials.accessTokenSecret
    )

    // 添加签名到参数中
    oauthParams.oauth_signature = signature
    console.log("✍️ OAuth签名生成完成:", {
      signature: signature.substring(0, 10) + "..."
    })

    // 生成Authorization header
    const authHeader =
      "OAuth " +
      Object.entries(oauthParams)
        .map(
          ([key, value]) => `${key}="${encodeURIComponent(value as string)}"`
        )
        .join(", ")

    console.log(
      "🔑 Authorization Header:",
      authHeader.substring(0, 100) + "..."
    )

    // 创建FormData
    const formData = new FormData()
    formData.append("media", new Blob([imageBuffer]), "image.png")

    // API调用
    console.log("🚀 发送上传请求...")
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData
    })

    console.log("📊 上传响应:", {
      status: response.status,
      statusText: response.statusText
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ 上传失败详情:", errorText)
      throw new Error(`Failed to upload image: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log("✅ 上传成功:", result)
    return result.media_id_string
  } catch (error) {
    console.error("❌ 图片上传失败:", error)
    throw error
  }
}

// OAuth签名生成函数 - 修复签名算法
function generateOAuthSignature(
  method: string,
  url: string,
  params: any,
  consumerSecret: string,
  tokenSecret: string
) {
  // 确保参数不包含oauth_signature
  const cleanParams = { ...params }
  delete cleanParams.oauth_signature

  // 按字母顺序排序参数
  const sortedParams = Object.keys(cleanParams)
    .sort()
    .map(
      key =>
        `${encodeURIComponent(key)}=${encodeURIComponent(cleanParams[key])}`
    )
    .join("&")

  // 构建签名基础字符串
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join("&")

  // 构建签名密钥
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  console.log("🔍 签名调试信息:", {
    sortedParams: sortedParams.substring(0, 100) + "...",
    signatureBaseString: signatureBaseString.substring(0, 100) + "...",
    signingKeyLength: signingKey.length
  })

  // 生成HMAC-SHA1签名
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64")

  return signature
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
    oauth_signature: ""
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
