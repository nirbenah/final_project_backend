import User from './models/User.js';
import amqp from 'amqplib'
import axios from "axios";
import { ORDER_URL } from './index.js'

let channel, connection;
const amqpServerUrl = 'amqps://jddswdas:q7Z2M-xcXHpB_-_XKdMbWAQ2uqmUW6ay@shark.rmq.cloudamqp.com/jddswdas'

export async function consumeMessage() {
    connection = await amqp.connect(amqpServerUrl);
    channel = await connection.createChannel();
    await channel.assertQueue("user-nextEvent-post-queue");
    await channel.assertQueue("user-nextEvent-put-queue");
    await channel.assertQueue("user-nextEvent-delete-queue");
    console.log('Listening for Rabbit messages...');

    channel.consume("user-nextEvent-post-queue", async (data) => {
        console.log("Consumed from user-nextEvent-post-queue");
        const obj = JSON.parse(data.content); // = { username: XXX, eventId: XXX, eventTitle: XXX, eventStartDate: XXX }
        const username = obj.username;
        const eventId = obj.eventId;
        const eventTitle = obj.eventTitle;
        const eventStartDate = obj.eventStartDate;
        // console.log(obj)
        let users;
        try {
            users = await User.find({ username: username });
        } catch (e) {
            console.error("Failed request in rabbitMQ)");
            return;
        }
        const user = users[0];
        const now = new Date();
        if (!user.nextEventId || (new Date(eventStartDate).getTime() < new Date(user.nextEventDate).getTime() && now.getTime() < new Date(eventStartDate).getTime())) {
            updateUserNextEvent(user, eventId, eventTitle, eventStartDate);
        }
        channel.ack(data);
    });

    channel.consume("user-nextEvent-put-queue", async (data) => {
        console.log("Consumed from user-nextEvent-put-queue");
        const obj = JSON.parse(data.content); // = { username: XXX, eventId: XXX, eventTitle: XXX, eventStartDate: XXX }
        const username = obj.username;
        const eventId = obj.eventId;
        const eventStartDate = obj.eventStartDate
        const eventTitle = obj.eventTitle
        console.log(obj)
        let users;

        try {
            users = await User.find({ username: username });
        } catch (e) {
            console.error("Failed request in rabbitMQ 1", e);
            return;
        }
        const user = users[0];
        const now = new Date()

        // if user has no next event or next event date has passed
        if(!eventId || !eventStartDate || !eventTitle) {
            updateUserNextEventFromOrderApi(user);
        }
        // user purchase new ticket that starts earlier 
        else if (new Date(eventStartDate).getTime() < new Date(user.nextEventDate).getTime() && now.getTime() < new Date(eventStartDate).getTime()) {
            updateUserNextEvent(user, eventId, eventTitle, eventStartDate);
        }
        // user refund ticket that is currently the next event
        else if (eventId == user.nextEventId) {
            updateUserNextEventFromOrderApi(user);
        }
        channel.ack(data);
    });

    channel.consume("user-nextEvent-delete-queue", async (data) => {
        console.log("Consumed from user-nextEvent-delete-queue");
        const obj = JSON.parse(data.content); // = { username: XXX, eventId: XXX}
        const username = obj.username;
        const eventId = obj.eventId;
        console.log(obj)
        let users;
        try {
            users = await User.find({ username: username });
        } catch (e) {
            console.error("Failed request in rabbitMQ)");
            return;
        }
        const user = users[0];
        if (user.nextEventId == eventId) {
            updateUserNextEventFromOrderApi(user);
        }
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

const updateUserNextEvent = async (user, eventId, eventTitle, eventStartDate) => {
    user.nextEventId = eventId;
    user.nextEventTitle = eventTitle;
    user.nextEventDate = eventStartDate;
    try {
        await user.save();
    } catch (e) {
        console.error("Failed request in rabbitMQ 2");
        return;
    }
};

// Function to update user's next event information from order API
const updateUserNextEventFromOrderApi = async (user) => {
    try {
        const res = await axios.get(`${ORDER_URL}/api/order/nextEvent/${user.username}`, { withCredentials: true });
        console.log("res:");
        console.log(res);
        user.nextEventId = res.data.eventId;
        user.nextEventTitle = res.data.eventTitle;
        user.nextEventDate = res.data.eventStartDate;
        await user.save();
    } catch (e) {
        console.error("Failed request in rabbitMQ 3");
        return;
    }
};
