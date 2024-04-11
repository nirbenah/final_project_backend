
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import {authMiddleware} from './authMiddleware.js'

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
export const ampqServerUrl = process.env.AMQP_SERVER_URL;

const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

async function connectToDatabase() {
    try {
        await mongoose.connect(dbURI);
        console.log('Connected to database successfully!');
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

connectToDatabase();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get(GET_COMMENTS_WITH_PAGINATION, authMiddleware, getCommentsRoute);
app.post(POST_COMMENT, authMiddleware, postCommentRoute);

app.listen(port, () => {
    console.log(`Server running! port ${port}`);
});

