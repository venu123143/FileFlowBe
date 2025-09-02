import type { InferSchemaType } from "@/utils/validation";
import { type Context } from "hono";
import res from "@/utils/response";
import userDtoValidation from "@/validation/user.validation";
import userRepository from "@/repository/user.repository";
import userService from "@/services/user.service";
import type { IUserAttributes } from "@/models/User.model";


/**
 * Signs up a user.
 * @param c - Hono context
 * @returns user created successfully
 */
const Signup = async (c: Context) => {
    try {
        // Get the validated phone number from the request
        type SendOtpBody = InferSchemaType<typeof userDtoValidation.signupValidation>;
        const { email, password, avatar_url, display_name } = c.get('validated') as SendOtpBody;
        // Check if user exists and account status
        const user = await userRepository.findUserByEmail(email);
        if (user) {
            return res.FailureResponse(c, 400, {
                message: "User already exists",
            });
        }

        // Hash the password
        const passwordHash = await userService.hashPassword(password);

        // Create user
        await userRepository.createUser(email, passwordHash, avatar_url, display_name);

        return res.SuccessResponse(c, 201, {
            message: "User created successfully",
            data: {},
        });
    } catch (error) {
        // Handle any errors with a failure response
        return res.FailureResponse(c, 500, {
            message: "Internal Server Error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

const Login = async (c: Context) => {
    try {
        type LoginBody = InferSchemaType<typeof userDtoValidation.loginValidation>;
        const { email, password } = c.get('validated') as LoginBody;
        // Check if user exists and account status
        const user = await userRepository.findUserByEmail(email);
        if (!user) {
            return res.FailureResponse(c, 400, {
                message: "User not found",
            });
        }
        // Check if password is correct
        const isPasswordCorrect = await userService.verifyPassword(password, user.password_hash);

        if (!isPasswordCorrect) {
            return res.FailureResponse(c, 400, {
                message: "Invalid password",
            });
        }
        // Generate session
        const session = await userService.generateSession(user);
        return res.SuccessResponse(c, 200, {
            message: "Login successful",
            data: session,
        });

    } catch (error) {

    }
}

const getAllUsers = async (c: Context) => {
    try {
        const validated = c.get('validated') as InferSchemaType<typeof userDtoValidation.getAllUsersValidation>;
        const users = await userRepository.getAllUsers(validated);
        return res.SuccessResponse(c, 200, { message: "Users retrieved successfully", data: users });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const logout = async (c: Context) => {
    try {
        // Get user from context (set by auth middleware)
        const user = c.get('user');
        if (!user) {
            return res.FailureResponse(c, 401, {
                message: "User not authenticated.",
            });
        }

        // Get the session token from Authorization header
        const authorization = c.req.header("Authorization");
        const sessionToken = authorization!.split(" ")[1];
        if (!sessionToken) {
            return res.FailureResponse(c, 401, {
                message: "Session token not found.",
            });
        }

        // Perform logout (deactivate session in DB and remove from Redis)
        const logoutSuccess = await userService.logout(user.id, sessionToken);

        if (!logoutSuccess) {
            return res.FailureResponse(c, 500, {
                message: "Logout failed. Please try again.",
            });
        }

        // Return success response for logout
        return res.SuccessResponse(c, 200, {
            message: "Logout successful",
            data: {
                user_id: user.id,
                email: user.email,
            },
        });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const logoutAll = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        await userService.logoutAllSessions(user.id);
        return res.SuccessResponse(c, 200, { message: "Logout all sessions successful", data: {} });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

export default {
    Signup,
    Login,
    getAllUsers,
    logout,
    logoutAll
}