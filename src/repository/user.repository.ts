import db from "@/config/database";
import { Op } from "sequelize";
import { type IUserSessionAttributes } from "@/models/UserSession.model";
import { UserRole } from "@/models/User.model";
interface GetAllUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    email_verified?: boolean;
}

const saveSession = async (login_details: IUserSessionAttributes) => {
    await db.User.update({ last_login: new Date() }, { where: { id: login_details.user_id } });
    return await db.UserSession.create(login_details);
}

const deleteSessionByToken = async (session_token: string) => {
    return await db.UserSession.destroy({ where: { session_token } });
}

const findActiveSessionsByUserId = async (user_id: string) => {
    return await db.UserSession.findAll({ where: { user_id, is_active: true } });
}
const deactivateSessionByToken = async (session_token: string) => {
    return await db.UserSession.update({ is_active: false }, { where: { session_token } });
}
const findUserByEmail = async (email: string) => {
    return await db.User.findOne({ where: { email }, raw: true });
}

const createUser = async (email: string, password: string, avatar_url: string, display_name: string) => {
    return await db.User.create({ email, password_hash: password, avatar_url, display_name, role: UserRole.USER });
}



const getAllUsers = async (validated: GetAllUsersParams, user_id: string) => {
    const { page = 1, limit = 10, search, is_active, email_verified } = validated;

    // ✅ Pagination
    const offset = (page - 1) * limit;

    const whereClause: any = {
        // Exclude the current user
        id: { [Op.ne]: user_id }
    };

    if (search) {
        whereClause[Op.or] = [
            { email: { [Op.like]: `%${search}%` } },
            { display_name: { [Op.like]: `%${search}%` } }
        ];
    }
    if (is_active !== undefined && typeof is_active === "boolean") {
        whereClause.is_active = is_active;
    }
    if (email_verified !== undefined && typeof email_verified === "boolean") {
        whereClause.email_verified = email_verified;
    }

    const { rows, count } = await db.User.findAndCountAll({
        where: whereClause,
        offset,
        limit,
        raw: true,
        order: [["created_at", "DESC"]],
        attributes: ["id", "email", "display_name", "avatar_url", "created_at"]
    });

    return {
        users: rows,
        metadata: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    };
};

const updatePin = async (user_id: string, pin_hash: string) => {
    const [affectedRows] = await db.User.update(
        { pin_hash },
        { where: { id: user_id } }
    );
    return affectedRows > 0;
};


export default {
    saveSession,
    deleteSessionByToken,
    findActiveSessionsByUserId,
    findUserByEmail,
    deactivateSessionByToken,
    createUser,
    getAllUsers,
    updatePin
}
