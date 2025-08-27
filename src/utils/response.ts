import { type Context } from 'hono';

interface SuccessData {
    status?: number;
    message?: string;
    data: {
        [key: string]: any;
    };
}

interface FailureData {
    message: string;
    status?: number;
    [key: string]: any;
}

type FailureStatus = 400 | 401 | 403 | 404 | 413 | 422 | 429 | 409 | 500 | 503;

const RESPONSE = {
    SuccessResponse: (c: Context, code: 200 | 201, data: SuccessData) => {
        return c.json({ success: true, ...data, }, code);
    },
    FailureResponse: (c: Context, code: FailureStatus, data: FailureData) => {
        return c.json({ success: false, ...data, }, code);
    },
};

export default RESPONSE;
