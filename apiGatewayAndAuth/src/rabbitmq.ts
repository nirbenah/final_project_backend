import User from './models/User.js';
import amqp from 'amqplib'
import axios from "axios";
import { ORDER_URL } from './index.js'
import {generateAuthToken} from './index.js'

let channel, connection;
const amqpServerUrl = process.env.AMQP_SERVER_URL

export async function consumeMessage() {
    try{
        connection = await amqp.connect(amqpServerUrl);
        channel = await connection.createChannel();
        await channel.assertQueue("user-nextEvent-post-queue");
        await channel.assertQueue("user-nextEvent-put-queue");
        await channel.assertQueue("user-nextEvent-delete-queue");
        console.log('Listening for Rabbit messages...');
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }

    try{
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
                channel.nack(data);
                return;
            }
            const user = users[0];
            const now = new Date();
            if (!user.nextEventId || (new Date(eventStartDate).getTime() < new Date(user.nextEventDate).getTime() && now.getTime() < new Date(eventStartDate).getTime())) {
                try{
                    updateUserNextEvent(user, eventId, eventTitle, eventStartDate);
                    channel.ack(data);
                }catch (e) {
                    channel.nack(data);
                }
            }
        });
    } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
    }


    try{
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
                channel.nack(data);
                return;
            }
            const user = users[0];
            const now = new Date()
            try{
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
            }catch (e) {
                channel.nack(data);
            }
            channel.ack(data);
        });
    } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
    }


    try{
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
                channel.nack(data);
                console.error("Failed request in rabbitMQ)");
                return;
            }
            const user = users[0];
            if (user.nextEventId == eventId) {
                try{
                    updateUserNextEventFromOrderApi(user);
                }catch (e) {
                    channel.nack(data);
                }
            }
            channel.ack(data);
        });
    } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
    }
    
}

export async function produceMessage(queueName: string, obj: any) {
    console.log("produceMessage was called")
    if (!channel) {
      console.log("New channel was established from produceMessage")
      try{
        connection = await amqp.connect(amqpServerUrl);
        channel = await connection.createChannel();
      } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }
    }
    try{
        channel.sendToQueue(
            queueName,
            Buffer.from(
              JSON.stringify(
                obj
              )
            )
        );
    }catch (error) {
        console.error('Error publishing message:', error);
    }
    
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
        const res = await axios.get(`${ORDER_URL}/api/order/nextEvent/Nirke`, { withCredentials: true , headers: {
            'authorization': generateAuthToken(process.env.INTERNAL_TOKEN_CODE, process.env.INTERNAL_TOKEN_KEY)}});
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
