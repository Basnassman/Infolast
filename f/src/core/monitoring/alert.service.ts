export const sendAlert = async (message: string, level: "info" | "warning" | "critical") => {

  // حاليا بسيط (console)
  console.log(`[ALERT - ${level}] ${message}`);

  // لاحقًا تقدر تضيف:
  // - Telegram bot
  // - Discord webhook
  // - Email alerts
};

export const detectSuspiciousActivity = (user: any) => {
  if (user.riskScore > 80) {
    sendAlert(`High risk user detected: ${user.wallet}`, "critical");
  }
};