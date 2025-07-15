# 刷新令牌错误修复方案

## 问题描述

用户在使用应用时遇到 "Invalid Refresh Token: Refresh Token Not Found" 错误，这通常发生在：

1. 用户的刷新令牌已过期或被删除
2. 用户在不同设备间切换导致令牌不同步
3. 数据库中的认证会话数据有问题
4. 浏览器缓存中的令牌数据损坏

## 解决方案

### 1. 创建统一的错误处理工具函数

**文件**: `lib/utils.ts`

新增了 `handleRefreshTokenError` 函数来统一处理刷新令牌错误：

```typescript
export const handleRefreshTokenError = async (
  error: any,
  supabase: any,
  router: any
): Promise<boolean> => {
  const isRefreshTokenError = 
    error?.code === 'refresh_token_not_found' ||
    error?.message?.includes('Invalid Refresh Token') ||
    error?.status === 400 ||
    error?.message?.includes('JWT') ||
    error?.message?.includes('refresh_token');

  if (isRefreshTokenError) {
    console.log("Invalid refresh token detected, clearing session...")
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (signOutError) {
      console.error("Error during sign out:", signOutError)
    }
    return true
  }
  
  return false
}
```

### 2. 更新全局状态管理

**文件**: `components/utility/global-state.tsx`

在以下位置添加了错误处理：

#### fetchStartingData 函数
```typescript
} catch (error: any) {
  console.error("Error in fetchStartingData:", error)
  
  // 使用工具函数处理刷新令牌错误
  const isRefreshTokenError = await handleRefreshTokenError(error, supabase, router)
  if (isRefreshTokenError) {
    return null
  }
  
  // 重新抛出其他错误
  throw error
}
```

#### useEffect 初始化
```typescript
} catch (error: any) {
  console.error("Error fetching starting data:", error)
  
  // 使用工具函数处理刷新令牌错误
  const isRefreshTokenError = await handleRefreshTokenError(error, supabase, router)
  if (isRefreshTokenError) {
    return
  }
}
```

#### 认证状态变化监听器
```typescript
} catch (error: any) {
  console.error("Error in auth state change handler:", error)
  
  // 使用工具函数处理刷新令牌错误
  await handleRefreshTokenError(error, supabase, router)
}
```

### 3. 错误处理逻辑

当检测到刷新令牌错误时，系统会：

1. **记录错误日志**：在控制台输出详细的错误信息
2. **清除会话**：调用 `supabase.auth.signOut()` 清除本地认证状态
3. **重定向到登录页面**：使用 `router.push("/login")` 将用户重定向到登录页面
4. **清理状态**：清除相关的应用状态数据

### 4. 错误检测条件

系统会检测以下类型的刷新令牌错误：

- `error.code === 'refresh_token_not_found'`
- `error.message.includes('Invalid Refresh Token')`
- `error.status === 400`
- `error.message.includes('JWT')`
- `error.message.includes('refresh_token')`

## 使用效果

### 用户体验
- **自动处理**：用户无需手动处理令牌错误
- **无缝重定向**：自动跳转到登录页面
- **状态清理**：确保应用状态的一致性

### 开发者体验
- **统一处理**：所有刷新令牌错误都使用相同的处理逻辑
- **易于维护**：错误处理逻辑集中在一个工具函数中
- **详细日志**：便于调试和问题排查

## 测试建议

1. **模拟令牌过期**：手动删除浏览器的认证令牌
2. **跨设备测试**：在不同设备上登录同一账户
3. **网络中断测试**：在网络不稳定时测试认证流程
4. **长时间会话测试**：测试长时间不活动后的会话恢复

## 注意事项

1. **数据丢失**：清除会话会导致未保存的数据丢失，建议在关键操作前提醒用户
2. **用户体验**：频繁的令牌错误可能影响用户体验，建议优化令牌刷新机制
3. **安全性**：确保在清除会话时正确处理敏感数据

## 后续优化建议

1. **令牌自动刷新**：实现更智能的令牌刷新机制
2. **离线支持**：添加离线模式下的数据缓存
3. **错误通知**：向用户显示友好的错误提示
4. **会话恢复**：实现会话恢复功能，减少重新登录的需求 