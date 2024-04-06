
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import {
    getCommentsRoute,
    postCommentRoute,
} from './routes.js';

import {
    GET_COMMENTS_WITH_PAGINATION,
    POST_COMMENT
} from './const.js';

dotenv.config();
const port = process.env.PORT || 5000;
export const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:4000";
export const COMMENT_URL = process.env.COMMENT_URL || "http://localhost:5000";
export const EVENT_URL = process.env.EVENT_URL || "http://localhost:6000";
export const ORDER_URL = process.env.ORDER_URL || "http://localhost:7000";

const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

async function connectToDatabase() {
    try {
        await mongoose.connect(dbURI);
        console.log('Connected to database successfully!');
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

const allowedOrigins = [API_GATEWAY_URL, COMMENT_URL, EVENT_URL, ORDER_URL];

connectToDatabase();
const app = express();
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get(GET_COMMENTS_WITH_PAGINATION, getCommentsRoute);
app.post(POST_COMMENT, postCommentRoute);

app.listen(port, () => {
    console.log(`Server running! port ${port}`);
});

