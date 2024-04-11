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
  // try{
  //   channel.consume("order-delete-queue", async (data) => {
  //     console.log("Consumed from order-delete-queue");
  //     const obj = JSON.parse(data.content); // = { orderId: XXX}
  //     let res;
  //     try {
  //       res = await axios.delete(`${port}/api/order/${obj.orderId}`, { withCredentials: true, headers: {
  //         'authorization': generateAuthToken(process.env.INTERNAL_TOKEN_CODE, process.env.INTERNAL_TOKEN_KEY)} });
  
  //     } catch (e) {
  //       const status = e.response?.status;
  //       if (status < 500) {
  //         console.error("invalid id / id not exist");
  //         return;
  //       } else if (status == 500) {
  //         console.error("server error. Retries");
  //         channel.nack(data);
  //         return;
  //       }
  //     }
  //     channel.ack(data);
  //   });
  // } catch (error) {
  //       console.error('Error consuming messages from RabbitMQ:', error);
  // }

  try{
    channel.consume("order-refund-queue", async (data) => {
      console.log("Consumed from order-refund-queue");
      // try{
        const obj = JSON.parse(data.content);
        const orderId = obj.orderId;
        let tries = 0;
        let works = false;
        while(tries < 10 && !works){
          const response = await refund({ orderId: orderId });
          //console.log("response.status " + response.status )
          if (response.status != 200){
            //console.error("!response.ok");
            tries++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before sending the next request
            //throw new Error(response.statusText);
          }
          else{
            works = true;
          }
        }
        if(!works){
          console.error("Problem in refund, 10 different tries");
        }
        else{
          channel.ack(data);
        }

      // }catch(e){
      //   console.error("error in refund, continue to retry with RabbitMQ");
      //   channel.nack(data);
      // }
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
