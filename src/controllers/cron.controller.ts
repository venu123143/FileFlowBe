import schedule from "node-schedule";
import CronDatabase from "@/repository/cron.repository";
import LockService from "@/services/lock.service";

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

// 🕛 Daily cleanup of expired tokens (12:00 AM IST)
schedule.scheduleJob({ rule: "0 0 * * *", tz: "Asia/Kolkata" }, async () => {
    console.log(`[${getISTTime()}] Running cron: Removing expired tokens`);

    const result = await LockService.executeWithLock("remove-expired-tokens", async () => {
        const count = await CronDatabase.removeAllExpiredTokens();
        console.log(`[${getISTTime()}] ✅ Removed ${count} expired tokens`);
        return count;
        // 10 minutes TTL
    }, 600);

    if (result === null) {
        console.log(`[${getISTTime()}] ⏭️  Skipped: Another instance is already removing expired tokens`);
    }
});

// 🕛 Daily cleanup of expired shares (12:05 AM IST)
schedule.scheduleJob({ rule: "5 0 * * *", tz: "Asia/Kolkata" }, async () => {
    console.log(`[${getISTTime()}] Running cron: Removing expired shares`);

    const result = await LockService.executeWithLock("remove-expired-shares",
        async () => {
            const count = await CronDatabase.removeAllExpiredShares();
            console.log(`[${getISTTime()}] ✅ Removed ${count} expired shares`);
            return count;
        },
        600 // 10 minutes TTL
    );

    if (result === null) {
        console.log(`[${getISTTime()}] ⏭️  Skipped: Another instance is already removing expired shares`);
    }
});

// 🕐 Daily cleanup of old files in trash (1:00 AM IST)
schedule.scheduleJob({ rule: "0 1 * * *", tz: "Asia/Kolkata" }, async () => {
    console.log(`[${getISTTime()}] Running cron: Removing files older than 30 days from trash`);

    const result = await LockService.executeWithLock("remove-old-deleted-files", async () => {
        const deletedIds = await CronDatabase.removeOldDeletedFiles();
        console.log(`[${getISTTime()}] ✅ Removed ${deletedIds.length} old files from trash`);
        return deletedIds;
    }, 1800); // 30 minutes TTL (this job may take longer)

    if (result === null) {
        console.log(`[${getISTTime()}] ⏭️  Skipped: Another instance is already removing old files`);
    }
});

// 🕛 Daily cleanup of read notifications older than 30 days (2:00 AM IST)
schedule.scheduleJob({ rule: "0 2 * * *", tz: "Asia/Kolkata" }, async () => {
    console.log(`[${getISTTime()}] Running cron: Removing old read notifications`);

    const result = await LockService.executeWithLock("remove-old-notifications", async () => {
        const count = await CronDatabase.removeOldReadNotifications();
        console.log(`[${getISTTime()}] ✅ Removed ${count} old read notifications`);
        return count;
    }, 600); // 10 minutes TTL

    if (result === null) {
        console.log(`[${getISTTime()}] ⏭️  Skipped: Another instance is already removing old notifications`);
    }
});
