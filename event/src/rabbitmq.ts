import amqp from 'amqplib';
import mongoose from 'mongoose';
import Event from "./models/Event.js";
import * as dotenv from "dotenv";
import { updateTicketsMinPrice } from './routes.js';


// RabbitMQ connection and channel

let channel, connection;
dotenv.config();
const amqpServerUrl = process.env.AMQP_SERVER_URL


export async function consumeMessage() {
    console.log("consumeMessage was called");
    try {
        connection = await amqp.connect(amqpServerUrl);
        channel = await connection.createChannel();
        console.log("New channel was established from connectToRabbitMQ")
        await channel.assertQueue("event-tickets-queue");
        await channel.assertQueue("event-comments-queue");
        console.log('Waiting for messages...');
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }
    try {
        channel.consume("event-comments-queue", async (data) => {
            console.log("Consumed from event-comments-queue");
            const eventId_obj = JSON.parse(data.content); // = { event_id: '4' }
            console.log(eventId_obj)
            const eventId = eventId_obj.event_id
            console.log(eventId)
            try {
                await incrementCommentsNumberNoReqRes(eventId);
                channel.ack(data);
            } catch {
                channel.nack(data);
            }
        });
    } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
    }
    try {
        channel.consume("event-tickets-queue", async (data) => {
            console.log("Consumed from event-tickets-queue");
            const obj = JSON.parse(data.content); // = { eventID: 'XXX', ticketType: 'XXX', quantity: 'XXX' }
            console.log("consume message", obj);
            try {
                await incrementTicketAvailability(obj);
                channel.ack(data);
            } catch (e) {
                console.error("error in incrementTicketAvailability: " + e.message);
                if (e.message == "Server Error") {
                    channel.nack(data);
                }
            }

        });
    } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
    }


}

export async function produceMessage(queueName: string, obj: any) {
    console.log("produceMessage was called")
    try {
        if (!channel) {
            console.log("New channel was established from produceMessage");
            connection = await amqp.connect(amqpServerUrl);
            channel = await connection.createChannel();
        }
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }
    try {
        channel.sendToQueue(
            queueName,
            Buffer.from(
                JSON.stringify(
                    obj
                )
            )
        );
    } catch (error) {
        console.error('Error publishing message:', error);
    }

}

export const incrementCommentsNumberNoReqRes = async (eventId: number) => {
    try {
        await Event.updateOne(
            { _id: eventId },
            { $inc: { commentsNumber: 1 } }
        );
    } catch (error) {
        throw new Error('Server Error');
    }
};

// Function to increment ticket's availability
const incrementTicketAvailability = async (obj: any) => {
    try {
        // Deserialize the message
        const { eventID, ticketType, quantity } = obj;
        console.log("incrementTicketAvailability", eventID, ticketType, quantity)

        // Perform validation on inputs
        if (!eventID || !ticketType || !quantity || quantity <= 0) {
            throw new Error('Invalid message format');
        }

        // Fetch the event from the database
        let event;
        try {
            event = await Event.findById(eventID);

        } catch (e) {
            throw new Error('Server Error');
        }

        if (!event) {
            throw new Error('Event not found');
        }

        // Find the ticket in the event
        const ticketIndex = event.tickets.findIndex((ticket) => ticket.name === ticketType);
        if (ticketIndex === -1) {
            throw new Error('Ticket not found');
        }

        const ticket = event.tickets[ticketIndex];
        const quantityToIncrement = parseInt(quantity);

        // Perform the increment operation
        if (ticket.available < ticket.quantity) {
            // Start a database session and transaction
            try {
                const session = await mongoose.startSession();
                session.startTransaction();

                // Update the ticket availability
                await Event.updateOne(
                    {
                        _id: eventID,
                        [`tickets.${ticketIndex}.available`]: { $gte: 0 },
                        tickets_available: { $gte: 0 }
                    },
                    { $inc: { [`tickets.${ticketIndex}.available`]: quantityToIncrement, tickets_available: quantityToIncrement } },
                    { session }
                );  // I changed here from gt to gte, because with gt if someone checkedout with all the tickets of a category it did not increment

                // Commit the transaction
                await session.commitTransaction();
                session.endSession();

            } catch (e) {
                throw new Error('Server Error');
            }

        } else {
            console.error("Availability is already at maximum");
            throw new Error('Availability is already at maximum');
        }
        updateTicketsMinPrice(event.id);
        // Return the event ID as output
        return event.id;
    } catch (error) {
        console.error(error);
        throw error;
    }
};