import db from "@/config/database"; ``
import { type IUserSessionAttributes } from "@/models/UserSession.model";

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
    return await db.User.create({ email, password_hash: password, avatar_url, display_name });
}

export default {
    saveSession,
    deleteSessionByToken,
    findActiveSessionsByUserId,
    findUserByEmail,
    deactivateSessionByToken,
    createUser
}
