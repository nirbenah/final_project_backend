
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
try{
    // Connect to mongoDB
    //const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    const dbURI = `mongodb+srv://nir:tMHPJOL68p3SQVGD@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    
    await mongoose.connect(dbURI);
    console.log("Connectedddd")
/* ========== */
}catch(error){
    console.log("didnt connect", error)

}


const port = process.env.PORT || 5000;
const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";

const app = express();

app.use(express.json());
app.use(cookieParser());
// const corsOptions = {
//     origin: frontendURL,
//     credentials: true,
//   };
// app.use(cors(corsOptions));

app.post('/', (req, res) => {
    res.send('Hello World!');
});


app.get(GET_COMMENTS_WITH_PAGINATION, getCommentsRoute);
app.post(POST_COMMENT, postCommentRoute);

app.listen(port, () => {
    console.log(`Server running! port ${port}`);
});

// TODO: update permissions

