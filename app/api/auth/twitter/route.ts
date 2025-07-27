import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import crypto from "crypto"

// 生成OAuth 1.0a请求令牌
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "request_token") {
      // 检查环境变量
      if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
        throw new Error("Twitter API credentials not configured")
      }

      console.log("🔍 检查环境变量:")
      console.log(
        "TWITTER_API_KEY:",
        process.env.TWITTER_API_KEY ? "已设置" : "未设置"
      )
      console.log(
        "TWITTER_API_SECRET:",
        process.env.TWITTER_API_SECRET ? "已设置" : "未设置"
      )
      console.log("NEXT_PUBLIC_SITE_URL:", process.env.NEXT_PUBLIC_SITE_URL)

      // 第一步：获取请求令牌
      const requestTokenUrl = "https://api.twitter.com/oauth/request_token"
      const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/twitter/callback`

      // 生成OAuth参数
      const oauthParams = {
        oauth_callback: callbackUrl,
        oauth_consumer_key: process.env.TWITTER_API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString("hex"),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: "1.0"
      }

      console.log("📝 OAuth参数:", oauthParams)

      // 生成OAuth签名
      const signature = generateOAuthSignature(
        "POST",
        requestTokenUrl,
        oauthParams,
        process.env.TWITTER_API_SECRET,
        "" // 请求令牌阶段token secret为空
      )

      // 添加签名到参数中
      const finalParams = {
        ...oauthParams,
        oauth_signature: signature
      }

      // 构建Authorization头
      const authHeader =
        "OAuth " +
        Object.entries(finalParams)
          .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
          .join(", ")

      console.log("🔐 Authorization Header:", authHeader)

      // 发送请求
      const response = await fetch(requestTokenUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      })

      console.log("📊 Twitter API响应状态:", response.status)
      console.log(
        "📊 Twitter API响应头:",
        Object.fromEntries(response.headers.entries())
      )

      const responseText = await response.text()
      console.log("📊 Twitter API响应内容:", responseText)

      if (!response.ok) {
        throw new Error(`Twitter API错误 (${response.status}): ${responseText}`)
      }

      const params = new URLSearchParams(responseText)
      const oauthToken = params.get("oauth_token")

      if (!oauthToken) {
        throw new Error("Failed to get request token")
      }

      // 重定向到Twitter授权页面
      const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
      return NextResponse.redirect(authUrl)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("❌ Twitter OAuth详细错误:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      { error: "OAuth failed", details: errorMessage },
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
