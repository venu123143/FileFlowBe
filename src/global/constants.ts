

const OTP_VALID_DURATION = 10 * 60 * 1000; // 10 MINS in milliseconds
const RESEND_COOLDOWN_MINUTES = 1; // one minuite
const ACCESS_TOKEN_EXPIRY_TIME = 15 * 60; // 15 MINUTES in seconds
const REFRESH_TOKEN_EXPIRY_TIME = 30 * 24 * 60 * 60; // 30 DAYS in seconds
const INVITATION_EXPIRY_TIME = 30 * 24 * 60 * 60; // 30 DAYS in seconds
const VERIFY_EMAIL_EXPIRY_TIME = 7 * 24 * 60 * 60; // 7 DAYS in seconds
const SALT_ROUNDS = 10;
const IV_LENGTH = 16;
const CACHE_TTL = 3600; // Cache for 1 hour
const MAX_FILE_UPLOAD = 5 * 1024 * 1024;  //5mb
const CACHE_EXPIRATION_SECONDS = 3600;  // Cache for 1 hour
const MAX_PAGINATION_LIMIT = 100;
const CACHE_RESULT = false; // make it true for caching the results
const MAX_CPU_USAGE = 0.8; // 80% CPU usage threshold
const CLOUDFLARE_BASE_URL = "https://api.cloudflare.com/client/v4";
const FILE_TRASH_EXPIRY_TIME = 30
const SHARE_EXPIRY_TIME = 30 // 30 DAYS
const PIN_SESSION_DURATION_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

export default {
    CACHE_TTL,
    IV_LENGTH,
    CACHE_RESULT,
    SALT_ROUNDS,
    MAX_FILE_UPLOAD,
    MAX_CPU_USAGE,
    ACCESS_TOKEN_EXPIRY_TIME,
    REFRESH_TOKEN_EXPIRY_TIME,
    VERIFY_EMAIL_EXPIRY_TIME,
    OTP_VALID_DURATION,
    MAX_PAGINATION_LIMIT,
    CACHE_EXPIRATION_SECONDS,
    RESEND_COOLDOWN_MINUTES,
    INVITATION_EXPIRY_TIME,
    CLOUDFLARE_BASE_URL,
    FILE_TRASH_EXPIRY_TIME,
    SHARE_EXPIRY_TIME,
    PIN_SESSION_DURATION_MS,
}

