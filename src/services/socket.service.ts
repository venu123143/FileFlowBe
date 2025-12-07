import { Server, Socket, Namespace } from 'socket.io';
import jwt from '@/utils/jwt-token';
import type { IUserAttributes } from '@/models/User.model';
import { type ISessionData } from "@/types/hono";
import { type NotificationAttributes } from '@/models';
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import authService from "@/services/user.service";
import fileRepository from '@/repository/file.repository';
interface AuthenticatedSocket extends Socket {
    user?: IUserAttributes;
    user_id?: string
}


class SocketService {
    private io: Server | null = null;
    private notificationNamespace: Namespace | null = null;
    private socket: Socket | null = null;

    public initialize(io: Server): void {
        this.io = io;
        this.configureNotificationNamespace();
    }

    private configureNotificationNamespace(): void {
        if (!this.io) return;

        this.notificationNamespace = this.io.of('/notifications');
        this.setupMiddleware(this.notificationNamespace);
        this.setupNamespaceHandlers(this.notificationNamespace);
    }

    private setupMiddleware(namespace: Namespace): void {
        namespace.use(async (socket: AuthenticatedSocket, next) => {
            try {
                const token = socket.handshake.auth.token
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verifyJwtToken(token);
                const client = redisConn.getClient();
                const sessionKey = `${redisConstants.ACCESS_TOKEN_PREFIX}${decoded.id}:${token}`;
                const sessionData = await client.get(sessionKey);

                if (!sessionData) {
                    return next(new Error("Session expired or invalid."))
                }

                const { user } = authService.parseJson<ISessionData>(sessionData);

                socket.join(decoded.id);
                socket.user_id = decoded.id;
                socket.user = user;
                next();

            } catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    private setupNamespaceHandlers(namespace: Namespace): void {
        namespace.on('connection', (socket: AuthenticatedSocket) => {
            console.log(`User ${socket.user?.display_name} connected to notifications namespace with socket ${socket.id}`);
            this.socket = socket;

            socket.on("last_accessed", ({ file_id }: { file_id: string }) => {
                fileRepository.updateLastAccessed(file_id, socket.user?.id as string);
            });
            socket.on('disconnect', () => {
                console.log(`User ${socket.user?.id} disconnected from notifications namespace`);
            });
        });
    }

    public sendNotification(userId: string, notification: NotificationAttributes): void {
        // this.socket?.to(userId).emit('notification:new', notification);
        if (this.notificationNamespace) {
            this.notificationNamespace.to(userId).emit('notification:new', notification);
        }
    }
}

export default new SocketService();
