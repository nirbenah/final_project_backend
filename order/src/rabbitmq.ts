import axios from "axios";
import { port } from "./index.js"
import amqp from 'amqplib'
import Order from './models/order.js';
import {generateAuthToken} from './authMiddleware.js'
import { refund, processPayment, PaymentPayload } from './payment.js'

let channel, connection;
const amqpServerUrl = process.env.AMQP_SERVER_URL


export async function consumeMessage() {
  try{
    connection = await amqp.connect(amqpServerUrl);
    channel = await connection.createChannel();
    await channel.assertQueue("order-startDate-queue");
    await channel.assertQueue("order-delete-queue");
    await channel.assertQueue("order-refund-queue");
    console.log('Listening for Rabbit messages...');
  }catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }

  try{
    channel.consume("order-startDate-queue", async (data) => {
      console.log("Consumed from order-startDate-queue");
      const obj = JSON.parse(data.content); // = { event_id: XXX, start_date: date }
      const eventId = obj.eventId;
      const startDate = obj.startDate
      // console.log(obj)
      try{
        updateDatesInOrders(eventId, startDate)
        channel.ack(data);
      }catch{
        channel.nack(data);
      }
    });
  } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
  }

  try{
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
  } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
  }

  try{
    channel.consume("order-refund-queue", async (data) => {
      console.log("Consumed from order-refund-queue");
      try{
        const obj = JSON.parse(data.content);
        const orderId = obj.orderId;
        await refund({ orderId: orderId });
        channel.ack(data);
      }catch(e){
        console.error("error in refund, continue to retry with RabbitMQ");
        channel.nack(data);
      }
    });
  } catch (error) {
        console.error('Error consuming messages from RabbitMQ:', error);
  }

}

export async function produceMessage(queueName: string, obj: any) {
  console.log("produceMessage was called")
  if (!channel) {
    try{
      console.log("New channel was established from produceMessage")
      connection = await amqp.connect(amqpServerUrl);
      channel = await connection.createChannel();
    }catch (error) {
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
