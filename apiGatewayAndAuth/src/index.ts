import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authMiddleware } from './auth.js';
import { API_ENDPOINTS } from './const.js';
import mongoose from 'mongoose';
import { loginRoute, logoutRoute, signupRoute, getUserInfoFromCookie, updatePermissionRoute, getUserNextEventRoute } from './routes.js';
import { consumeMessage } from './rabbitmq.js'


const COMMENT_URL = process.env.EVENT_URL || "http://localhost:5000";
const EVENT_URL = process.env.EVENT_URL || "http://localhost:6000";
export const ORDER_URL = process.env.ORDER_URL ||"http://localhost:7000";

dotenv.config();

const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

async function connectToDatabase() {
    try {
        await mongoose.connect(dbURI);
        console.log('Connected to database successfully!');
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

const port = process.env.PORT || 4000;
const frontendURL = process.env.FRONTEND_URL || "http://localhost:5174";

connectToDatabase();
consumeMessage();
const app = express();
app.use(cookieParser());
app.use(cors({
    origin: [frontendURL, "http://localhost:5174"],
    credentials: true
}));

const createProxyMiddlewareWithAuth = (target) => {
    return (req, res, next) => {
        authMiddleware(req, res, () => {
            return createProxyMiddleware({
                target: target,
                changeOrigin: true,
                onError: (err, req, res) => {
                    console.error('Error communicating with microservice:', err.message);
                    res.status(500).json({ error: 'Internal server error. An unexpected error occurred.' });
                }
            })(req, res, next);
        });
    };
};


// Comments
app.get(API_ENDPOINTS.GET_COMMENTS, createProxyMiddlewareWithAuth(COMMENT_URL));
app.post(API_ENDPOINTS.POST_COMMENT, createProxyMiddlewareWithAuth(COMMENT_URL));

// Events
app.get(API_ENDPOINTS.GET_EVENT, createProxyMiddlewareWithAuth(EVENT_URL));
app.get(API_ENDPOINTS.GET_EVENTS, createProxyMiddlewareWithAuth(EVENT_URL));
app.get(API_ENDPOINTS.GET_AVAILABLE_EVENTS, createProxyMiddlewareWithAuth(EVENT_URL));
app.post(API_ENDPOINTS.POST_EVENT, createProxyMiddlewareWithAuth(EVENT_URL));
app.put(API_ENDPOINTS.INC_EVENT_TICKETS, createProxyMiddlewareWithAuth(EVENT_URL));
app.put(API_ENDPOINTS.DEC_EVENT_TICKETS, createProxyMiddlewareWithAuth(EVENT_URL));
app.put(API_ENDPOINTS.PUT_EVENT_DATES, createProxyMiddlewareWithAuth(EVENT_URL));
app.put(API_ENDPOINTS.PUT_EVENT_COMMENTS, createProxyMiddlewareWithAuth(EVENT_URL));

// Orders
app.get(API_ENDPOINTS.GET_ORDERS_BY_USER, createProxyMiddlewareWithAuth(ORDER_URL));
app.get(API_ENDPOINTS.GET_ORDERS_BY_EVENT, createProxyMiddlewareWithAuth(ORDER_URL));
app.get(API_ENDPOINTS.GET_NEXT_UPDATED_EVENT, createProxyMiddlewareWithAuth(ORDER_URL))
app.post(API_ENDPOINTS.POST_ORDER, createProxyMiddlewareWithAuth(ORDER_URL));
app.put(API_ENDPOINTS.UPDATE_ORDER, createProxyMiddlewareWithAuth(ORDER_URL));
app.delete(API_ENDPOINTS.DELETE_ORDER, createProxyMiddlewareWithAuth(ORDER_URL));
app.post(API_ENDPOINTS.PURCHASE, createProxyMiddlewareWithAuth(ORDER_URL));


app.listen(port, () => {
    console.log(`Server running! port ${port}`);
});

app.use(express.json());


app.post(API_ENDPOINTS.LOGIN, loginRoute);
app.post(API_ENDPOINTS.LOGOUT, logoutRoute);
app.post(API_ENDPOINTS.SIGNUP, signupRoute);
app.post(API_ENDPOINTS.UPDATE_PERMISSION, authMiddleware, updatePermissionRoute);
app.get(API_ENDPOINTS.GET_USER, getUserInfoFromCookie);
app.get(API_ENDPOINTS.GET_USER_NEXT_EVENT, getUserNextEventRoute);