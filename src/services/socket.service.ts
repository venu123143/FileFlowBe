import { Server, Socket, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { IUserAttributes } from '@/models/User.model';

interface AuthenticatedSocket extends Socket {
    user?: IUserAttributes;
}

interface NotificationPayload {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    created_at: Date;
    file_id?: string;
}

class SocketService {
    private io: Server | null = null;
    private connectedUsers: Map<string, string[]> = new Map();

    // Proper namespace types
    private notificationNamespace: Namespace | null = null

    public initialize(io: Server): void {
        this.io = io;
        this.configureSocketNamespaces();
    }

    private configureSocketNamespaces(): void {
        if (!this.io) return;
        // Initialize namespaces with proper typing
        this.notificationNamespace = this.io.of('/notifications');
        // Setup authentication for each namespace

        // this.setupMiddleware(this.notificationNamespace);
        this.setupNamespaceHandlers(this.notificationNamespace);

    }

    private setupMiddleware(namespace: Namespace): void {
        namespace.use(async (socket: AuthenticatedSocket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
                socket.user = { id: decoded.userId, ...decoded };
                next();
            } catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    private setupNamespaceHandlers(namespace: Namespace): void {
        const namespacePath = namespace.name;
        console.log(namespacePath, "namespacePath")
        namespace.on('connection', (socket: AuthenticatedSocket) => {
            console.log(`User ${socket.user?.id} connected to ${namespacePath} with socket ${socket.id}`);

            if (socket.user?.id) {
                this.addUserSocket(socket.user.id, socket.id);
                socket.join(`user:${socket.user.id}`);
            }

            // Handle namespace-specific events
            switch (namespacePath) {
                case '/notifications':
                    this.handleNotificationEvents(socket);
                    break;
                case '/files':
                    this.handleFileEvents(socket);
                    break;
                case '/chat':
                    this.handleChatEvents(socket);
                    break;
            }

            socket.on('disconnect', () => {
                console.log(`User ${socket.user?.id} disconnected from ${namespacePath}`);
                if (socket.user?.id) {
                    this.removeUserSocket(socket.user.id, socket.id);
                }
            });
        });
    }

    private handleNotificationEvents(socket: AuthenticatedSocket): void {
        socket.on('notification:read', (notificationId: string) => {
            if (socket.user?.id) {
                socket.to(`user:${socket.user.id}`).emit('notification:read', { notificationId });
            }
        });
    }

    private handleFileEvents(socket: AuthenticatedSocket): void {
        socket.on('file:typing', (data: { fileId: string; isTyping: boolean }) => {
            socket.to(`file:${data.fileId}`).emit('user:typing', {
                userId: socket.user?.id,
                isTyping: data.isTyping
            });
        });

        socket.on('file:join', (fileId: string) => {
            socket.join(`file:${fileId}`);
        });

        socket.on('file:leave', (fileId: string) => {
            socket.leave(`file:${fileId}`);
        });
    }

    private handleChatEvents(socket: AuthenticatedSocket): void {
        socket.on('chat:join', (roomId: string) => {
            socket.join(`chat:${roomId}`);
        });

        socket.on('chat:leave', (roomId: string) => {
            socket.leave(`chat:${roomId}`);
        });

        socket.on('chat:message', (data: { roomId: string; message: string }) => {
            socket.to(`chat:${data.roomId}`).emit('chat:message', {
                userId: socket.user?.id,
                message: data.message,
                timestamp: new Date()
            });
        });
    }

    private addUserSocket(userId: string, socketId: string): void {
        const userSockets = this.connectedUsers.get(userId) || [];
        userSockets.push(socketId);
        this.connectedUsers.set(userId, userSockets);
    }

    private removeUserSocket(userId: string, socketId: string): void {
        const userSockets = this.connectedUsers.get(userId) || [];
        const updatedSockets = userSockets.filter(id => id !== socketId);

        if (updatedSockets.length === 0) {
            this.connectedUsers.delete(userId);
        } else {
            this.connectedUsers.set(userId, updatedSockets);
        }
    }

    public getOnlineUsersCount(): number {
        return this.connectedUsers.size;
    }

    public isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    public getUserSockets(userId: string): string[] {
        return this.connectedUsers.get(userId) || [];
    }
}

export default new SocketService();