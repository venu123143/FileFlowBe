import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import config from "@/config/config";

export interface TokenAttributes {
    id: string;
    email: string;
    role: string;
}

async function generateEncryptedPayload(payload: TokenAttributes): Promise<string> {
    // Hash the secret key to ensure it is 32 bytes long
    const secretKey = crypto.createHash('sha256').update(config.JWT_REFRESH_SECRET as string).digest();

    const iv = crypto.randomBytes(16); // Generate a random IV
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);

    let encryptedPayload = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
    encryptedPayload += cipher.final('base64');

    const combinedPayload = iv.toString('base64') + ':' + encryptedPayload;
    return combinedPayload
}


function decryptToken(decoded: { encryptedData: string }): TokenAttributes {
    // Split the encrypted data into IV and the encrypted payload
    const [ivString, encryptedPayload] = decoded.encryptedData.split(':');
    // Convert IV string back to a Buffer
    if (!ivString) {
        throw new Error("Invalid token: IV string is missing.");
    }
    const iv = Buffer.from(ivString, 'base64');
    // Hash the secret key to ensure it is 32 bytes long
    const secretKey = crypto.createHash('sha256').update(config.JWT_REFRESH_SECRET as string).digest();
    // Create the decipher object using the same algorithm and secret key
    const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
    // Decrypt the payload
    if (!encryptedPayload) {
        throw new Error("Invalid token: Encrypted payload is missing.");
    }
    let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    // Parse and return the decrypted JSON object
    return JSON.parse(decrypted) as TokenAttributes;
}


const generateJwtToken = async (payload: TokenAttributes, expiryTime: number) => {
    // Create JWT with the encrypted payload
    const combinedPayload: string = await generateEncryptedPayload(payload)
    const token: string = jwt.sign({ encryptedData: combinedPayload }, config.JWT_REFRESH_SECRET as string, { expiresIn: expiryTime });
    return token;
};

const verifyJwtToken = (token: string): TokenAttributes => {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET as string) as { encryptedData: string };
    return decryptToken(decoded)
}

/**
 * Generate a refresh token (JWT with user payload)
 * @param payload - User data to include in the token
 * @param expiryTime - Expiry time in seconds
 * @returns Signed refresh token
 */
const generateRefreshToken = async (payload: TokenAttributes, expiryTime: number): Promise<string> => {
    const combinedPayload: string = await generateEncryptedPayload(payload);
    const token: string = jwt.sign(
        { encryptedData: combinedPayload },
        config.JWT_REFRESH_SECRET as string,
        { expiresIn: expiryTime }
    );
    return token;
};

/**
 * Verify a refresh token and return the decrypted payload
 * @param token - The refresh token to verify
 * @returns Decrypted token payload
 */
const verifyRefreshToken = (token: string): TokenAttributes => {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET as string) as { encryptedData: string };
    return decryptToken(decoded);
};

export default {
    generateJwtToken,
    verifyJwtToken,
    generateRefreshToken,
    verifyRefreshToken
};

