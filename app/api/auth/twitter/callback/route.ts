import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import crypto from "crypto"

// 添加这行配置，强制动态渲染
export const dynamic = "force-dynamic"

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

export async function GET(request: Request) {
  try {
    // 现在可以安全地使用request.url
    const { searchParams } = new URL(request.url)
    const oauthToken = searchParams.get("oauth_token")
    const oauthVerifier = searchParams.get("oauth_verifier")

    if (!oauthToken || !oauthVerifier) {
      // 返回HTML页面，通过postMessage通知父窗口认证失败
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Twitter认证</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'TWITTER_AUTH_FAILED',
                error: 'Missing oauth parameters'
              }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/chat?error=twitter_auth_failed';
            }
          </script>
          <p>认证失败，正在关闭窗口...</p>
        </body>
        </html>
      `,
        {
          headers: {
            "Content-Type": "text/html"
          }
        }
      )
    }

    // 第二步：交换访问令牌
    const accessTokenUrl = "https://api.twitter.com/oauth/access_token"

    const oauthParams = {
      oauth_consumer_key: process.env.TWITTER_API_KEY!,
      oauth_nonce: crypto.randomBytes(16).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: "1.0",
      oauth_signature: "" // 先设置为空字符串
    }

    // 生成签名
    const signature = generateOAuthSignature(
      "POST",
      accessTokenUrl,
      oauthParams,
      process.env.TWITTER_API_SECRET!,
      ""
    )
    oauthParams.oauth_signature = signature // 现在可以正常赋值

    const authHeader =
      "OAuth " +
      Object.entries(oauthParams)
        .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
        .join(", ")

    const response = await fetch(accessTokenUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    })

    const responseText = await response.text()
    const params = new URLSearchParams(responseText)

    const accessToken = params.get("oauth_token")
    const accessTokenSecret = params.get("oauth_token_secret")
    const userId = params.get("user_id")
    const screenName = params.get("screen_name")

    if (!accessToken || !accessTokenSecret) {
      // 返回HTML页面，通过postMessage通知父窗口认证失败
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Twitter认证</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'TWITTER_AUTH_FAILED',
                error: 'Failed to get access token'
              }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/chat?error=twitter_auth_failed';
            }
          </script>
          <p>认证失败，正在关闭窗口...</p>
        </body>
        </html>
      `,
        {
          headers: {
            "Content-Type": "text/html"
          }
        }
      )
    }

    // 保存用户的Twitter凭证到数据库
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (user) {
      const { error: dbError } = await supabase
        .from("user_twitter_auth")
        .upsert({
          user_id: user.id,
          twitter_user_id: userId,
          screen_name: screenName,
          access_token: accessToken,
          access_token_secret: accessTokenSecret,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (dbError) {
        console.error("Database error:", dbError)
        // 即使数据库保存失败，也通知认证失败
        return new NextResponse(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Twitter认证</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'TWITTER_AUTH_FAILED',
                  error: 'Database save failed'
                }, window.location.origin);
                window.close();
              } else {
                window.location.href = '/chat?error=twitter_auth_failed';
              }
            </script>
            <p>认证失败，正在关闭窗口...</p>
          </body>
          </html>
        `,
          {
            headers: {
              "Content-Type": "text/html"
            }
          }
        )
      }
    }

    // 认证成功，返回HTML页面通过postMessage通知父窗口
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Twitter认证成功</title>
      </head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'TWITTER_AUTH_SUCCESS',
              data: {
                screenName: '${screenName}',
                userId: '${userId}'
              }
            }, window.location.origin);
            window.close();
          } else {
            window.location.href = '/chat?twitter_auth=success';
          }
        </script>
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>✅ Twitter认证成功！</h2>
          <p>正在关闭窗口并自动分享...</p>
        </div>
      </body>
      </html>
    `,
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    )
  } catch (error) {
    console.error("Twitter callback error:", error)

    // 安全地获取错误消息
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    // 返回HTML页面，通过postMessage通知父窗口认证失败
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Twitter认证</title>
      </head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'TWITTER_AUTH_FAILED',
              error: 'Server error: ${errorMessage}'
            }, window.location.origin);
            window.close();
          } else {
            window.location.href = '/chat?error=twitter_auth_failed';
          }
        </script>
        <p>认证失败，正在关闭窗口...</p>
      </body>
      </html>
    `,
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    )
  }
}
