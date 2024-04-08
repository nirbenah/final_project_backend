import axios from "axios";
import { port } from "./index.js"
import amqp from 'amqplib'
import Order from './models/order.js';
import {generateAuthToken} from './authMiddleware.js'

let channel, connection;
const amqpServerUrl = 'amqps://jddswdas:q7Z2M-xcXHpB_-_XKdMbWAQ2uqmUW6ay@shark.rmq.cloudamqp.com/jddswdas'


export async function consumeMessage() {
  connection = await amqp.connect(amqpServerUrl);
  channel = await connection.createChannel();
  await channel.assertQueue("order-startDate-queue");
  await channel.assertQueue("order-delete-queue");
  console.log('Listening for Rabbit messages...');
  channel.consume("order-startDate-queue", async (data) => {
    console.log("Consumed from order-startDate-queue");
    const obj = JSON.parse(data.content); // = { event_id: XXX, start_date: date }
    const eventId = obj.eventId;
    const startDate = obj.startDate
    // console.log(obj)
    updateDatesInOrders(eventId, startDate)
    //const result = await 
    channel.ack(data);
  });
  channel.consume("order-delete-queue", async (data) => {
    console.log("Consumed from order-delete-queue");
    const obj = JSON.parse(data.content); // = { orderId: XXX}
    let res;
    try {
      res = await axios.delete(`${port}/api/order/${obj.orderId}`, { withCredentials: true, headers: {
        'authorization': generateAuthToken(process.env.INTERNAL_TOKEN_CODE, process.env.INTERNAL_TOKEN_KEY)} });

    } catch (e) {
      const status = e.response?.status;
      if (status < 500) {
        console.error("invalid id / id not exist");
        return;
      } else if (status == 500) {
        console.error("server error. Retries");
        channel.nack(data);
        return;
      }
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

export async function updateDatesInOrders(eventId, startDate) {
  const orders = await Order.find({ eventID: eventId });
  // console.log(orders)
  orders.forEach(async (order) => {
    order.eventStartDate = startDate;
    const obj = { username: order.username, eventId: order.eventID, eventTitle: order.eventTitle, eventStartDate: order.eventStartDate };
    console.log(obj)
    produceMessage("user-nextEvent-put-queue", obj);
    await order.save();
  });
}
