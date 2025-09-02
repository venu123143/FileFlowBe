import schedule from "node-schedule";
import CronDatabase from "@/repository/cron.repository";

// helper to format IST time
const getISTTime = () => {
    return new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,           // 12-hour format with AM/PM
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

// 🕛 Daily cleanup of expired tokens
schedule.scheduleJob("0 0 * * *", async () => {
    console.log(`[${getISTTime()}] Running cron: Removing expired tokens`);
    await CronDatabase.removeAllExpiredTokens();
});

// 🕛 Daily cleanup of expired shares
schedule.scheduleJob("5 0 * * *", async () => {
    console.log(`[${getISTTime()}] Running cron: Removing expired shares`);
    await CronDatabase.removeAllExpiredShares();
});

// 🕛 Run daily at 1:00 AM IST
schedule.scheduleJob("0 1 * * *", async () => {
    console.log(`[${getISTTime()}] Running cron: Removing files older than 30 days from trash`);
    await CronDatabase.removeOldDeletedFiles();
});
