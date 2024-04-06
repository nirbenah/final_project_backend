
import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from "dotenv";
import bodyParser from 'body-parser';
import cors from 'cors';
import { GET_NEXT_EVENT,  } from './const.js';
import { consumeMessage } from './rabbitmq.js';

import {
  getOrdersByEventRoute,
  getOrdersByUserRoute,
  getNextEventRoute,
  putOrdersRoute,
  deleteOrdersRoute,
  purchaseRoute,
  createOrderRoute,
} from './routes.js';

import {
  GET_ORDERS_BY_EVENT,
  GET_ORDERS_BY_USER,
  POST_ORDER,
  UPDATE_ORDER,
  DELETE_ORDER,
  PURCHASE
} from './const.js';

dotenv.config();

export const port = process.env.PORT || 7000;
export const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:4000";
export const COMMENT_URL = process.env.COMMENT_URL || "http://localhost:5000";
export const EVENT_URL = process.env.EVENT_URL || "http://localhost:6000";
export const ORDER_URL = process.env.ORDER_URL || "http://localhost:7000";
console.log('pass:', process.env.DBPASS);

const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.vpn2j6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

async function connectToDatabase() {
  try {
    await mongoose.connect(dbURI);
    console.log('Connected to database successfully!');
  } catch (error) {
    console.error('Error connecting to database:', error);
  }
}

// TODO: remove * from allowedOrigins
const allowedOrigins = [API_GATEWAY_URL, COMMENT_URL, EVENT_URL, ORDER_URL];

connectToDatabase();
consumeMessage();
const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.get(GET_ORDERS_BY_EVENT, getOrdersByEventRoute);
app.get(GET_ORDERS_BY_USER, getOrdersByUserRoute);
app.get(GET_NEXT_EVENT, getNextEventRoute);
app.post(PURCHASE, purchaseRoute);
app.post(POST_ORDER, createOrderRoute);
app.put(UPDATE_ORDER, putOrdersRoute);
app.delete(DELETE_ORDER, deleteOrdersRoute);


app.listen(port, () => {
  console.log(`Server running! port ${port}`);
});


