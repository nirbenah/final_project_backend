
import { Request, Response } from 'express';
import Event from "./models/Event.js";
import mongoose, { ObjectId } from 'mongoose';
import { handleError, sendJsonResponse, verifyDateStructure } from './utils.js';
import { ERROR_500 } from './const.js';
import { eventJoiSchema } from "./models/Event.js";
import { produceMessage } from './rabbitmq.js';

// Function to get event by ID
export const getEvent = async (req: Request, res: Response) => {
    let dbRes;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        handleError(res, 404, "Invalid Event ID");
        return;
    }
    const eventId = new mongoose.Types.ObjectId(req.params.id);

    try {
        dbRes = await Event.findById(eventId);
    }
    catch (err) {
        console.error(err);
        handleError(res, 500, ERROR_500);
        return;
    }
    if (!dbRes) {
        handleError(res, 404, "Event not found");
        return;
    }
    sendJsonResponse(res, 200, dbRes);
};

// Function to get events with pagination and filter by start date
export const getAllEvents = async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    try {
        const startIndex = (page - 1) * limit;

        const events = await Event.find()
            .skip(startIndex)
            .limit(limit);

        const total = await Event.countDocuments();
        sendJsonResponse(res, 200, { events: events, total: total });
    } catch (error) {
        console.error(error);
        handleError(res, 500, ERROR_500);
        return;
    }
};

// Function to get events with pagination and filter by start date
export const getAvailableEvents = async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    try {
        const now = new Date();
        const startIndex = (page - 1) * limit;

        const events = await Event.find({ start_date: { $gte: now }, tickets_available: { $gt: 0 } })
            .skip(startIndex)
            .limit(limit);

        const total = await Event.countDocuments({ start_date: { $gte: now }, tickets_available: { $gt: 0 } });
        sendJsonResponse(res, 200, { events: events, total: total });
    } catch (error) {
        console.error(error);
        handleError(res, 500, ERROR_500);
        return;
    }
};

// Function to add a new event
export const postEvent = async (req: Request, res: Response) => {
    console.log("Event is about to be created")
    let eventData = req.body;
    console.log("event recieved", eventData);
    let event;
    try {
        if (eventJoiSchema.validate(eventData).error) {
            handleError(res, 400, eventJoiSchema.validate(eventData).error.message);
            return;
        }
        if(eventData.start_date >= eventData.end_date){
            handleError(res, 400, "End date must be greater than start date");
            return;
        }
        else {
            event = new Event(eventData);

            // Set tickets availability, min price, and comments number
            let sum_tickets_avaliable = 0;
            let min_ticket_price = Number.MAX_VALUE;
            event.tickets.forEach((ticket) => {
                ticket.available = ticket.quantity;
                sum_tickets_avaliable += ticket.quantity;
                if (ticket.price < min_ticket_price) {
                    min_ticket_price = ticket.price;
                }
            });
            event.tickets_available = sum_tickets_avaliable;
            event.min_price = min_ticket_price;
            event.commentsNumber = 0;
            await event.save();
        }
    }
    catch (err) {
        console.error("oof", err);
        handleError(res, 500, ERROR_500);
        return;
    }
    sendJsonResponse(res, 201, { _id: event.id });
};

// Function to increment ticket's availability
export const incrementTicketAvailability = async (req: Request, res: Response) => {
    const eventId = new mongoose.Types.ObjectId(req.params.id);
    const event = await Event.findById(eventId);
    const ticketInfo = req.body;
    console.log("incrementing ticket availability");
    console.log("ticketInfo", ticketInfo,"for event", eventId);
    if (ticketInfo === undefined || ticketInfo.name === undefined || ticketInfo.name === ""
        || ticketInfo.quantity === undefined || parseInt(ticketInfo.quantity) <= 0) {
        handleError(res, 400, "Invalid ticket name");
        return;
    }
    if (!event) {
        handleError(res, 404, "Event not found");
        return;
    }
    // search ticket by name
    const ticketIndex = event.tickets.findIndex((ticket) => ticket.name === ticketInfo.name);
    if (ticketIndex === -1) {
        handleError(res, 404, "Ticket not found");
        return;
    }
    const ticket = event.tickets[ticketIndex];
    const quantityToIncrement = parseInt(ticketInfo.quantity);

    const session = await mongoose.startSession();
    session.startTransaction();
    if (ticket.available < ticket.quantity) {
        try {
            await Event.updateOne(
                {
                    _id: eventId,
                    $and: [
                        { [`tickets.${ticketIndex}.available`]: { $gt: 0 } },
                        { tickets_available: { $gt: 0 } }
                    ]
                },
                { $inc: { [`tickets.${ticketIndex}.available`]: quantityToIncrement, tickets_available: quantityToIncrement } },
                { session }
            );

            await session.commitTransaction();
            session.endSession();
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error(err);
            handleError(res, 500, ERROR_500);
            return;
        }
    } else {
        handleError(res, 400, "Availability is already at maximum");
        return;
    }

    sendJsonResponse(res, 200, { _id: event.id });
};


// Function to decrement ticket's availability
export const decrementTicketAvailability = async (req: Request, res: Response) => {
    const eventId = new mongoose.Types.ObjectId(req.params.id);
    const ticketInfo = req.body;
    console.log("decrementing ticket availability");
    console.log("ticketInfo", ticketInfo,"for event", eventId);
    if (ticketInfo === undefined || ticketInfo.name === undefined || ticketInfo.name === ""
        || ticketInfo.quantity === undefined || parseInt(ticketInfo.quantity) <= 0) {
        handleError(res, 400, "Invalid ticket name");
        return;
    }
    const event = await Event.findById(eventId);
    if (!event) {
        handleError(res, 404, "Event not found");
        return;
    }
    // search ticket by name
    const ticketIndex = event.tickets.findIndex((ticket) => ticket.name === ticketInfo.name);
    if (ticketIndex === -1) {
        handleError(res, 404, "Ticket not found");
        return;
    }

    const ticket = event.tickets[ticketIndex];
    const quantityToDecrement = parseInt(ticketInfo.quantity) * -1;

    const session = await mongoose.startSession();
    session.startTransaction();
    if (ticket.available >= ticketInfo.quantity) {
        try {
            await Event.updateOne(
                {
                    _id: eventId,
                    $and: [
                        { [`tickets.${ticketIndex}.available`]: { $gt: 0 } },
                        { tickets_available: { $gt: 0 } }
                    ]
                },
                { $inc: { [`tickets.${ticketIndex}.available`]: quantityToDecrement, tickets_available: quantityToDecrement } },
                { session }
            );

            await session.commitTransaction();
            session.endSession();
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error(err);
            handleError(res, 500, ERROR_500);
            return;
        }
    } else {
        handleError(res, 400, "Availability is already at minimum");
        return;
    }
    if (event.min_price === ticket.price) {
        updateTicketsMinPrice(event.id);
    }
    sendJsonResponse(res, 200, { _id: event.id });
};

// Function to update event's tickets information
const updateTicketsMinPrice = async (eventId: ObjectId) => {
    const event = await Event.findById(eventId);
    // TODO: if none of the tickets are available, what is the min_price? 
    let min_ticket_price = Number.MAX_VALUE;
    event.tickets.forEach((ticket) => {
        if (ticket.available !== 0 && ticket.price < min_ticket_price) {
            min_ticket_price = ticket.price;
        }
    });
    try {
        min_ticket_price = min_ticket_price === Number.MAX_VALUE ? 0 : min_ticket_price;
        await Event.updateOne(
            { _id: event.id },
            { min_price: min_ticket_price }
        );
    } catch (err) {
        console.error(err);
    }
};

// Function to update event dates
export const updateEventDates = async (req: Request, res: Response) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        handleError(res, 404, "Invalid Event ID");
        return;
    }
    const eventId = new mongoose.Types.ObjectId(req.params.id);
    const updated_data = req.body;

    if (!updated_data.start_date || isNaN(Date.parse(updated_data.start_date)) ||
        !updated_data.end_date || isNaN(Date.parse(updated_data.end_date)) || updated_data.start_date >= updated_data.end_date) {
        handleError(res, 400, "Invalid dates format");
        return;
    }

    let existingEvent;
    try {
        existingEvent = await Event.findById(eventId);
    }
    catch (error) {
        handleError(res, 500, ERROR_500);
        return;
    }

    if (!existingEvent) {
        handleError(res, 404, "Event not found");
        return;
    }
    const startDate = new Date(updated_data.start_date);
    const endDate = new Date(updated_data.end_date);

    if (existingEvent.start_date > startDate) {
        handleError(res, 400, "new start date must be greater than the current start date");
        return;
    }

    existingEvent.start_date = startDate;
    existingEvent.end_date = endDate;

    try {
        await existingEvent.save();
        const update_dates_obj = {eventId, startDate}
        produceMessage("order-startDate-queue", update_dates_obj)
    }
    catch (error) {
        handleError(res, 500, ERROR_500);
        return;
    }
    console.log("Event dates updated successfully");
    sendJsonResponse(res, 200, { _id: existingEvent._id });
};


// Function to update comments number for an event
export const incrementCommentsNumber = async (req: Request, res: Response) => {
    const eventId = new mongoose.Types.ObjectId(req.params.id);
    try {
        await Event.updateOne(
            { _id: eventId },
            { $inc: { commentsNumber: 1 } }
        );
    } catch (error) {
        handleError(res, 500, ERROR_500);
        return;
    }
    sendJsonResponse(res, 200, { _id: eventId });
};

export const incrementCommentsNumberNoReqRes = async (eventId: number) => {
    try {
        await Event.updateOne(
            { _id: eventId },
            { $inc: { commentsNumber: 1 } }
        );
    } catch (error) {
        // to complete    
        return;
    }
};
