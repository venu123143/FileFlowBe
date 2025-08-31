import { IUserAttributes, User } from '@/models/User.model';
import { IUserSessionAttributes } from '@/models/UserSession.model';
import { type Session } from 'hono-sessions';


interface ISessionData {
    login_details: IUserSessionAttributes;
    user: IUserAttributes;
}

declare module 'hono' {
    interface ContextVariableMap {
        session: Session;
        user: User | null;
        validated: T; // will be inferred and narrowed by the schema in runtime
        user_id: string;
    }
}
