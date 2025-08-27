

export const options = {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5000",
        "http://localhost:5173",
    ],
    credentials: true,
    exposedHeaders: ["sessionid", "logintoken", "resettoken", "ratelimit-remaining"],
    allowedHeaders: ["sessionid", "resettoken", "logintoken", "Content-Type", "Authorization", "token", "locale", "x-device-token"],
};