const { ethers } = require('ethers');

// 模拟测试数据
const address = "0x4ad2d68e31e42e4c03e7a179d7af276a6f54ded9";
const message = "登录Chatbot UI\n\n时间戳: 1752350667818\n地址: 0x4ad2d68e31e42e4c03e7a179d7af276a6f54ded9\n\n请签名以验证您的身份。";
const signature = "0x68ee9ff1e0ba870418ce40f8ac5d815207d8afbec2f5a1f9b19f1a545e668a057d748f013cf3ca1da3a00d3618c4250cd72589266d1419bc93ef0b95738659a21c";

console.log("=== 签名验证测试 ===");
console.log("地址:", address);
console.log("消息:", message);
console.log("签名:", signature);
console.log("消息长度:", message.length);
console.log("消息字节:", Buffer.from(message, 'utf8').toString('hex'));

// 验证签名
try {
  const recoveredAddress = ethers.utils.verifyMessage(message, signature);
  console.log("\n=== 验证结果 ===");
  console.log("恢复的地址:", recoveredAddress);
  console.log("原始地址:", address);
  console.log("地址匹配:", recoveredAddress.toLowerCase() === address.toLowerCase());
  
  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    console.log("\n=== 调试信息 ===");
    console.log("恢复地址小写:", recoveredAddress.toLowerCase());
    console.log("原始地址小写:", address.toLowerCase());
    console.log("差异:", recoveredAddress.toLowerCase() !== address.toLowerCase());
  }
} catch (error) {
  console.error("签名验证错误:", error);
}

// 测试不同的消息格式
console.log("\n=== 测试不同消息格式 ===");
const testMessages = [
  "登录Chatbot UI\n\n时间戳: 1752350667818\n地址: 0x4ad2d68e31e42e4c03e7a179d7af276a6f54ded9\n\n请签名以验证您的身份。",
  "登录Chatbot UI\n时间戳: 1752350667818\n地址: 0x4ad2d68e31e42e4c03e7a179d7af276a6f54ded9\n请签名以验证您的身份。",
  "登录Chatbot UI 时间戳: 1752350667818 地址: 0x4ad2d68e31e42e4c03e7a179d7af276a6f54ded9 请签名以验证您的身份。"
];

testMessages.forEach((testMessage, index) => {
  try {
    const recovered = ethers.utils.verifyMessage(testMessage, signature);
    console.log(`消息格式 ${index + 1}:`, recovered.toLowerCase() === address.toLowerCase() ? "匹配" : "不匹配");
  } catch (error) {
    console.log(`消息格式 ${index + 1}: 错误`);
  }
});