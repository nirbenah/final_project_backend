import amqp from 'amqplib'
import Order from './models/order.js';
import { refund} from './payment.js'
import * as dotenv from "dotenv";

let channel, connection;
dotenv.config();
const amqpServerUrl = process.env.AMQP_SERVER_URL


export async function consumeMessage() {
  try {
    console.log("rabbit server url ----------------- ", amqpServerUrl)
    connection = await amqp.connect(amqpServerUrl);
    channel = await connection.createChannel();
    await channel.assertQueue("order-startDate-queue");
    await channel.assertQueue("order-delete-queue");
    await channel.assertQueue("order-refund-queue");
    console.log('Listening for Rabbit messages...');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }

  try {
    channel.consume("order-startDate-queue", async (data) => {
      console.log("Consumed from order-startDate-queue");
      const obj = JSON.parse(data.content); // = { event_id: XXX, start_date: date }
      const eventId = obj.eventId;
      const startDate = obj.startDate
      try {
        updateDatesInOrders(eventId, startDate)
        channel.ack(data);
      } catch {
        channel.nack(data);
      }
    });
  } catch (error) {
    console.error('Error consuming messages from RabbitMQ:', error);
  }
  try {
    channel.consume("order-delete-queue", async (data) => {
      console.log("Consumed from order-delete-queue");
      const obj = JSON.parse(data.content); // = { orderId: XXX}
      const orderId = obj.orderId;
      let order;
      try {
        order = await Order.findById(orderId);
        if (!order) {
          console.error('Order not found in order-delete-queue');
          return;
        }
      } catch (error) {
        console.error("internal server error in order-delete-queue. retries till the server works");
        channel.nack(data);
      }
      const order_eventID = order.eventID;
      const order_ticketType = order.ticketType;
      const order_quantity = order.quantity;
      try {
        await order.deleteOne();
      } catch (error) {
        console.error("internal server error in order-delete-queue. retries till the server works");
        channel.nack(data);
      }
      const event_obj = { eventID: order_eventID, ticketType: order_ticketType, quantity: order_quantity }
      produceMessage("event-tickets-queue", event_obj)
      //next Event update:
      const objToNextEvent = { username: order.username, eventId: order.eventID };
      produceMessage("user-nextEvent-delete-queue", objToNextEvent);
      channel.ack(data);
    });
  } catch (error) {
    console.error('Error consuming messages from RabbitMQ:', error);
  }

  try {
    channel.consume("order-refund-queue", async (data) => {
      console.log("Consumed from order-refund-queue");
      const obj = JSON.parse(data.content);
      const orderId = obj.orderId;
      let tries = 0;
      let works = false;
      while (tries < 10 && !works) {
        const response = await refund({ orderId: orderId });
        if (response.status != 200) {
          tries++;
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before sending the next request
        }
        else {
          works = true;
        }
      }
      if (!works) {
        console.error("Problem in refund, 10 different tries");
      }
      else {
        channel.ack(data);
      }
    });
  } catch (error) {
    console.error('Error consuming messages from RabbitMQ:', error);
  }
}

export async function produceMessage(queueName: string, obj: any) {
  console.log("produceMessage was called")
  if (!channel) {
    try {
      console.log("New channel was established from produceMessage")
      connection = await amqp.connect(amqpServerUrl);
      channel = await connection.createChannel();
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
    }

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

export async function updateDatesInOrders(eventId, startDate) {
  const orders = await Order.find({ eventID: eventId });
  orders.forEach(async (order) => {
    order.eventStartDate = startDate;
    const obj = { username: order.username, eventId: order.eventID, eventTitle: order.eventTitle, eventStartDate: order.eventStartDate };
    console.log(obj)
    produceMessage("user-nextEvent-put-queue", obj);
    await order.save();
  });
}
