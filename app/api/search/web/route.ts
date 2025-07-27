import { NextResponse } from "next/server"

export async function POST(request: Request) {
  let query = ""
  let num = 5

  try {
    const requestData = await request.json()
    query = requestData.query
    num = requestData.num || 5

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      )
    }

    // 检查是否有 SerpAPI 密钥
    const serpApiKey = process.env.SERPAPI_API_KEY

    if (!serpApiKey) {
      return NextResponse.json(
        {
          error: "需要配置 SERPAPI_API_KEY 环境变量",
          message:
            "请在 .env.local 文件中添加 SERPAPI_API_KEY=your_api_key_here",
          instructions: {
            step1: "访问 https://serpapi.com/ 注册账户",
            step2: "获取免费的 API 密钥（每月100次免费搜索）",
            step3:
              "在项目根目录的 .env.local 文件中添加：SERPAPI_API_KEY=your_api_key_here",
            step4: "重启开发服务器"
          }
        },
        { status: 400 }
      )
    }

    // 使用 SerpAPI 进行真实搜索
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${num}&api_key=${serpApiKey}`

    const response = await fetch(searchUrl)

    if (!response.ok) {
      throw new Error(
        `SerpAPI request failed: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    // 格式化 SerpAPI 结果
    const results = (data.organic_results || [])
      .slice(0, num)
      .map((result: any) => ({
        title: result.title || "无标题",
        snippet: result.snippet || result.description || "无描述",
        url: result.link || "",
        source: result.displayed_link || "Google Search"
      }))

    return NextResponse.json({
      query,
      results,
      total: results.length
    })
  } catch (error) {
    console.error("Web search error:", error)

    // 提供备用的模拟结果
    const fallbackResults = [
      {
        title: `搜索: ${query}`,
        snippet: `由于网络搜索服务暂时不可用，无法获取关于 "${query}" 的实时信息。建议您稍后重试或查看其他信息源。`,
        url: "#",
        source: "系统提示"
      }
    ]

    return NextResponse.json({
      query,
      results: fallbackResults,
      total: fallbackResults.length,
      error: "搜索服务暂时不可用"
    })
  }
}
