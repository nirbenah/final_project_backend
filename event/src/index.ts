import mongoose from "mongoose";
import { POST_EVENT, GET_EVENT, GET_EVENTS, INC_EVENT_TICKETS, DEC_EVENT_TICKETS, PUT_EVENT_DATES, PUT_EVENT_COMMENTS, GET_AVAILABLE_EVENTS } from "./const.js";
import { getAllEvents, getAvailableEvents, postEvent, getEvent, incrementCommentsNumber, incrementTicketAvailability, decrementTicketAvailability, updateEventDates } from "./routes.js";
import * as dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { consumeMessage } from "./rabbitmq.js";

dotenv.config();
const port = process.env.PORT || 6000;
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
consumeMessage();
const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.get(GET_EVENT, getEvent);
app.get(GET_EVENTS, getAllEvents);
app.get(GET_AVAILABLE_EVENTS, getAvailableEvents);
app.post(POST_EVENT, postEvent);
app.put(INC_EVENT_TICKETS, incrementTicketAvailability);
app.put(DEC_EVENT_TICKETS, decrementTicketAvailability);
app.put(PUT_EVENT_DATES, updateEventDates);
app.put(PUT_EVENT_COMMENTS, incrementCommentsNumber);


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});