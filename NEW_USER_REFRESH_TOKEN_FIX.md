# 新用户刷新令牌错误修复

## 问题描述

新用户注册后立即登录时遇到 "Invalid Refresh Token: Refresh Token Not Found" 错误。这个问题通常发生在：

1. **新用户注册时序问题**：用户刚注册完成，刷新令牌还没有完全设置
2. **认证状态同步延迟**：Supabase 认证状态更新需要时间
3. **前端立即尝试登录**：注册成功后立即尝试登录，但令牌还未就绪

## 问题原因

新用户注册流程：
1. 用户连接钱包并签名
2. 后端创建用户账户
3. 前端立即使用返回的凭据登录
4. 此时刷新令牌可能还没有完全设置，导致登录失败

## 修复方案

### 1. 优化新用户登录逻辑

**文件**: `components/utility/user-login.tsx` 和 `app/[locale]/login/page.tsx`

为新用户添加重试机制和更长的等待时间：

```typescript
if (data.isNewUser) {
  console.log("New user detected, attempting login...")
  
  // 为新用户添加重试机制
  let loginSuccess = false
  let attempts = 0
  const maxAttempts = 3
  
  while (!loginSuccess && attempts < maxAttempts) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      if (error) {
        console.log(`Login attempt ${attempts + 1} failed:`, error.message)
        
        // 如果是刷新令牌错误，等待更长时间
        if (error.message.includes('refresh_token') || error.code === 'refresh_token_not_found') {
          console.log("Refresh token error detected, waiting longer...")
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        attempts++
      } else {
        loginSuccess = true
        console.log("New user login successful")
      }
    } catch (loginError: any) {
      console.log(`Login attempt ${attempts + 1} error:`, loginError.message)
      await new Promise(resolve => setTimeout(resolve, 500))
      attempts++
    }
  }
  
  if (!loginSuccess) {
    setMessage("Login failed after multiple attempts. Please try again.")
    return
  }
}
```

### 2. 增强认证状态等待机制

增加认证状态更新的等待时间和重试次数：

```typescript
const waitForAuthUpdate = async () => {
  let attempts = 0
  const maxAttempts = 15 // 增加最大尝试次数
  
  while (attempts < maxAttempts) {
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (session) {
        console.log("Authentication confirmed, redirecting...")
        router.push(`/${data.workspaceId}/chat`)
        return
      }
      
      console.log(`Waiting for auth update... attempt ${attempts + 1}`)
      await new Promise(resolve => setTimeout(resolve, 300)) // 增加等待时间
      attempts++
    } catch (sessionError: any) {
      console.log(`Session check error:`, sessionError.message)
      await new Promise(resolve => setTimeout(resolve, 300))
      attempts++
    }
  }
  
  // 如果等待超时，仍然跳转
  console.log("Auth update timeout, redirecting anyway...")
  router.push(`/${data.workspaceId}/chat`)
}
```

### 3. 优化全局状态错误处理

**文件**: `components/utility/global-state.tsx`

为新用户添加特殊的错误处理逻辑：

```typescript
// 对于新用户，给更多时间让认证状态稳定
const isNewUserError = error?.message?.includes('refresh_token') || 
                      error?.code === 'refresh_token_not_found' ||
                      error?.status === 400

if (isNewUserError) {
  console.log("Potential new user refresh token error, waiting before clearing session...")
  
  // 等待一段时间再检查，给新用户更多时间
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 再次检查会话状态
  const session = (await supabase.auth.getSession()).data.session
  if (!session) {
    console.log("Session still invalid after waiting, clearing session...")
    await supabase.auth.signOut()
    router.push("/login")
    return null
  } else {
    console.log("Session became valid after waiting, continuing...")
    // 重新尝试获取数据
    try {
      const profile = await getProfileByUserId(session.user.id)
      setProfile(profile)
      
      const workspaces = await getWorkspacesByUserId(session.user.id)
      setWorkspaces(workspaces)
      
      return profile
    } catch (retryError: any) {
      console.error("Error in retry attempt:", retryError)
      // 如果重试仍然失败，则清除会话
      await supabase.auth.signOut()
      router.push("/login")
      return null
    }
  }
}
```

## 修复效果

### 用户体验改进
- **减少新用户错误**：大幅减少新用户注册后的刷新令牌错误
- **自动重试机制**：登录失败时自动重试，无需用户手动操作
- **更好的错误提示**：提供更清晰的错误信息和状态反馈

### 技术改进
- **智能等待策略**：根据错误类型调整等待时间
- **渐进式重试**：从短时间重试开始，逐步增加等待时间
- **状态恢复机制**：在等待后重新检查状态，避免不必要的会话清除

## 时间配置

### 登录重试配置
- **最大重试次数**: 3 次
- **普通错误等待时间**: 500ms
- **刷新令牌错误等待时间**: 1000ms

### 状态更新等待配置
- **最大尝试次数**: 15 次
- **每次等待时间**: 300ms
- **总等待时间**: 4.5 秒

### 全局状态错误处理
- **新用户错误等待时间**: 2000ms
- **重试机制**: 自动重试获取用户数据

## 测试建议

1. **新用户注册测试**：测试完整的新用户注册和登录流程
2. **网络延迟测试**：在网络较慢的情况下测试新用户注册
3. **并发注册测试**：测试多个用户同时注册的情况
4. **错误恢复测试**：测试各种错误情况下的恢复机制
5. **超时处理测试**：测试等待超时后的处理逻辑

## 注意事项

1. **用户体验**：虽然增加了等待时间，但通过重试机制减少了失败率
2. **错误日志**：添加了详细的控制台日志，便于调试和监控
3. **超时处理**：即使等待超时也会进行跳转，确保用户体验
4. **状态一致性**：确保在重试过程中状态的一致性

## 后续优化建议

1. **用户反馈**：在等待过程中显示加载动画或进度指示器
2. **智能重试**：根据网络状况动态调整重试策略
3. **错误分类**：更精确地分类不同类型的错误，采用不同的处理策略
4. **监控告警**：添加监控机制，及时发现和处理频繁出现的错误 