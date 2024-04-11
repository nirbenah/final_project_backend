
import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from "dotenv";
import bodyParser from 'body-parser';
import { GET_NEXT_EVENT,  } from './const.js';
import { consumeMessage } from './rabbitmq.js';
import {authMiddleware} from './authMiddleware.js'


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
export const EVENT_URL = process.env.EVENT_URL || "http://localhost:6000";

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
consumeMessage();
const app = express();
app.use(bodyParser.json());

app.get(GET_ORDERS_BY_EVENT, authMiddleware, getOrdersByEventRoute);
app.get(GET_ORDERS_BY_USER, authMiddleware, getOrdersByUserRoute);
app.get(GET_NEXT_EVENT, authMiddleware, getNextEventRoute);
app.post(PURCHASE, authMiddleware, purchaseRoute);
app.post(POST_ORDER, authMiddleware, createOrderRoute);
app.put(UPDATE_ORDER, authMiddleware, putOrdersRoute);
app.delete(DELETE_ORDER, authMiddleware, deleteOrdersRoute);


app.listen(port, () => {
  console.log(`Server running! port ${port}`);
});


