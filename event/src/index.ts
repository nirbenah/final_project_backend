import mongoose from "mongoose";
import { POST_EVENT, GET_EVENT, GET_EVENTS, INC_EVENT_TICKETS, DEC_EVENT_TICKETS, PUT_EVENT_DATES, PUT_EVENT_COMMENTS, GET_AVAILABLE_EVENTS } from "./const.js";
import { getAllEvents, getAvailableEvents, postEvent, getEvent, incrementCommentsNumber, incrementTicketAvailability, decrementTicketAvailability, updateEventDates } from "./routes.js";
import * as dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { consumeMessage } from "./rabbitmq.js";
import {authMiddleware} from './authMiddleware.js'


dotenv.config();
const port = process.env.PORT || 6000;
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

connectToDatabase();
consumeMessage();
const app = express();
app.use(bodyParser.json());

app.get(GET_EVENT, authMiddleware, getEvent);
app.get(GET_EVENTS, authMiddleware, getAllEvents);
app.get(GET_AVAILABLE_EVENTS, authMiddleware, getAvailableEvents);
app.post(POST_EVENT, authMiddleware, postEvent);
app.put(INC_EVENT_TICKETS, authMiddleware, incrementTicketAvailability);
app.put(DEC_EVENT_TICKETS, authMiddleware, decrementTicketAvailability);
app.put(PUT_EVENT_DATES, authMiddleware, updateEventDates);
app.put(PUT_EVENT_COMMENTS, authMiddleware, incrementCommentsNumber);


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});