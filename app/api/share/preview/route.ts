import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getServerProfile } from "@/lib/server/server-chat-helpers"

// 创建用于图片分享预览的动态页面
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")
    const text = searchParams.get("text")
    const imageUrl = searchParams.get("imageUrl")

    if (!messageId || !text || !imageUrl) {
      return new NextResponse("Missing required parameters", { status: 400 })
    }

    // 生成带有 Open Graph 元数据的 HTML 页面
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${text}</title>
  
  <!-- Open Graph 元数据 -->
  <meta property="og:title" content="${text}" />
  <meta property="og:description" content="来自 ChatBot UI 的分享" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${request.url}" />
  <meta property="og:site_name" content="ChatBot UI" />
  
  <!-- Twitter Card 元数据 -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${text}" />
  <meta name="twitter:description" content="来自 ChatBot UI 的分享" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="分享的图片" />
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }
    .image {
      width: 100%;
      max-width: 600px;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }
    .text {
      font-size: 18px;
      line-height: 1.6;
      color: #333;
      margin-bottom: 16px;
    }
    .footer {
      color: #666;
      font-size: 14px;
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    .share-button {
      display: inline-block;
      background: #1da1f2;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="text">${text}</div>
    <img src="${imageUrl}" alt="分享的图片" class="image" />
    <div class="footer">
      <p>来自 ChatBot UI 的分享</p>
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(request.url)}&text=${encodeURIComponent(text)}" 
         class="share-button" target="_blank">
        在 Twitter 上分享
      </a>
    </div>
  </div>
  
  <script>
    // 自动重定向到 Twitter 分享（可选）
    const autoShare = new URLSearchParams(window.location.search).get('autoShare');
    if (autoShare === 'true') {
      const twitterUrl = \`https://twitter.com/intent/tweet?url=\${encodeURIComponent(window.location.href)}&text=\${encodeURIComponent('${text}')}\`;
      window.open(twitterUrl, '_blank');
    }
  </script>
</body>
</html>
    `

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600" // 缓存 1 小时
      }
    })
  } catch (error) {
    console.error("Preview generation error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

// 创建分享预览链接
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { imageData, text, messageId } = await request.json()

    if (!imageData || !text || !messageId) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // 上传图片到 Supabase Storage
    const imageBuffer = Buffer.from(imageData.split(",")[1], "base64")
    const fileName = `share-${messageId}-${Date.now()}.jpg`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("message_files")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        cacheControl: "3600"
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return new NextResponse("Failed to upload image", { status: 500 })
    }

    // 获取公共 URL
    const {
      data: { publicUrl }
    } = supabase.storage.from("message_files").getPublicUrl(fileName)

    // 生成预览页面 URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const previewUrl = `${baseUrl}/api/share/preview?messageId=${encodeURIComponent(messageId)}&text=${encodeURIComponent(text)}&imageUrl=${encodeURIComponent(publicUrl)}`

    return NextResponse.json({
      success: true,
      previewUrl,
      imageUrl: publicUrl,
      twitterShareUrl: `https://twitter.com/intent/tweet?url=${encodeURIComponent(previewUrl)}&text=${encodeURIComponent(text)}`
    })
  } catch (error) {
    console.error("Share preview creation error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
