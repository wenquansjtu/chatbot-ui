// 强制设置白天模式的脚本
// 在浏览器控制台中运行此脚本

// 设置主题为白天模式
localStorage.setItem('theme', 'light');

// 移除任何深色主题的类
document.documentElement.classList.remove('dark');
document.documentElement.classList.add('light');

// 触发主题变化事件
window.dispatchEvent(new Event('storage'));

console.log('已设置为白天模式'); 