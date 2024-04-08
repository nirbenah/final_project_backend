import amqp from 'amqplib';
import mongoose from 'mongoose';
import Event from "./models/Event.js";


// RabbitMQ connection and channel

let channel, connection;
const amqpServerUrl = process.env.AMQP_SERVER_URL


export async function consumeMessage() {
    console.log("consumeMessage was called")
    connection = await amqp.connect(amqpServerUrl);
    channel = await connection.createChannel();
    console.log("New channel was established from connectToRabbitMQ")
    await channel.assertQueue("event-tickets-queue");
    await channel.assertQueue("event-comments-queue");
    console.log('Waiting for messages...');
    channel.consume("event-comments-queue", async (data) => {
        console.log("Consumed from event-comments-queue");
        const eventId_obj = JSON.parse(data.content); // = { event_id: '4' }
        console.log(eventId_obj)
        const eventId = eventId_obj.event_id
        console.log(eventId)
        const result = await incrementCommentsNumberNoReqRes(eventId)
        channel.ack(data);
    });
    channel.consume("event-tickets-queue", async (data) => {
        console.log("Consumed from event-tickets-queue");
        const obj = JSON.parse(data.content); // = { eventID: 'XXX', ticketType: 'XXX', quantity: 'XXX' }
        console.log("consume message", obj)
        const result = await incrementTicketAvailability(obj);
        channel.ack(data);
    });

}

export async function produceMessage(queueName: string, obj: any) {
    console.log("produceMessage was called")
    if (!channel) {
        console.log("New channel was established from produceMessage")
        connection = await amqp.connect(amqpServerUrl);
        channel = await connection.createChannel();
    }
    channel.sendToQueue(
        queueName,
        Buffer.from(
            JSON.stringify(
                obj
            )
        )
    );
}

export const incrementCommentsNumberNoReqRes = async (eventId: number) => {
    try {
        await Event.updateOne(
            { _id: eventId },
            { $inc: { commentsNumber: 1 } }
        );
    } catch (error) {
        throw new Error('server error');
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
        const event = await Event.findById(eventID);

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
        } else {
            console.error("Availability is already at maximum");
            throw new Error('Availability is already at maximum');
        }

        // Return the event ID as output
        return event.id;
    } catch (error) {
        console.error(error);
        throw error;
    }
};