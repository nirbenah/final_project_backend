
import { Request, Response } from 'express';
import Order from './models/order.js';
import mongoose, { ObjectId } from 'mongoose';
import { servicesApi } from './servicesAPI.js';
import { refund, processPayment, PaymentPayload } from './payment.js'
import { produceMessage } from './rabbitmq.js';

interface EventInfo {
  eventId: string;
  ticketType: string;
  quantity: number;
  start_date: Date;
}

const getOrdersRoute = async (req: Request, res: Response, by_what: string) => {
  const { page, limit, id } = req.query as { page?: string, limit?: string, id?: string };
  const real_limit: number = parseInt(limit || '0', 10)
  const start_index: number = (parseInt(page || '1', 10) - 1) * real_limit
  let orders = [];
  let total = 0;
  try {
    if (id) {
      if (by_what == "Event") {
        if (!limit) {
          orders = await Order.find({ eventID: id, isPaid: true }).sort({ eventStartDate: 1 });
        } else {
          orders = await Order.find({ eventID: id, isPaid: true }).skip(start_index).limit(real_limit).sort({ eventStartDate: 1 });
        }
        total = await Order.countDocuments({ eventID: id });
      }
      else if (by_what == "User") {
        console.log("get orders by user", id)
        if (!limit) {
          orders = await Order.find({ username: id, isPaid: true }).sort({ eventStartDate: 1 });
        } else {
          orders = await Order.find({ username: id, isPaid: true }).skip(start_index).limit(real_limit).sort({ eventStartDate: 1 });
        }
        total = await Order.countDocuments({ username: id, isPaid: true  });
      }
    }
  } catch (e) {
    res.status(500).send('Internal server error');
    return;
  }
  res.status(200).send({ orders: orders, total: total });
  return;
}

export const getOrdersByEventRoute = async (req: Request, res: Response) => {
  getOrdersRoute(req, res, "Event")
}

export const getOrdersByUserRoute = async (req: Request, res: Response) => {
  getOrdersRoute(req, res, "User")
}

export const createOrderRoute = async (req: Request, res: Response) => {
  console.log(req.body)
  const order = new Order(req.body);
  console.log("new Order")
  try {
    order.isStarted = false;
    order.isPaid = false;
    order.isTimedOut = false;
    await order.validate();
  }
  catch (error) {
    res.status(400).send('Invalid order format');
    return;
  }

  if (order.eventStartDate < new Date() || order.quantity <= 0) {
    res.status(400).send('Invalid order content');
    return;
  }

  try {
    await order.save();
  }
  catch (e) {
    res.status(500).send('Error creating order');
    return;
  }
  console.log("order created", order)
  // decrease tickets available
  const eventRes = await servicesApi.decrementTicketsAvailability(order.eventID, order.ticketType, order.quantity);
  if (eventRes.error) {
    // delete order - rabbit: V
    const obj = { orderId: order._id }
    produceMessage("order-delete-queue", obj);
    res.status(500).send("Internal server error");
    return;
  }
  console.log("order created", order._id, "and tickets saved")
  res.status(201).json({ orderId: order._id });

  initiateTimedCheckout(order._id, order.eventID, order.ticketType, order.quantity);
}

export const purchaseRoute = async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).send('Invalid order ID');
    return;
  }
  const orderId = new mongoose.Types.ObjectId(req.params.id);
  const payload: PaymentPayload = req.body;

  let updatedOrder;
  try {
    // find order and update isStarted = trueonly if timeout did not occur
    updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, isTimedOut: false },
      { $set: { isStarted: true } },
      { new: true }
    );
  } catch (error) {
    console.error('Error starting order:', error);
    res.status(500).send('Internal server error');
  }
  // order found before timeout and started
  if (updatedOrder) {
    makePayment(orderId, payload, res, updatedOrder);
  }

  // order not found because of isTimedOut = true - **try to purchuse again**
  else {
    let order;
    try {
      // find order and update isStarted = trueonly if timeout did not occur
      order = await Order.findOne({ _id: orderId });
    } catch (error) {
      console.error('Error finding order', error);
      res.status(500).send('Internal server error');
    }
    if (!order) {
      console.error('error was supposed to be found');
      res.status(500).send('Internal server error');
    }
    console.log("Trying to acquire tickets again");
    const eventRes = await servicesApi.decrementTicketsAvailability(order.eventID, order.ticketType, order.quantity);
    if (eventRes.error) {
      // delete order - rabbit: V
      const obj = { orderId: order._id }
      produceMessage("order-delete-queue", obj);
      res.status(500).send("Internal server error");
      return;
    }
    // TODO: put order {isStarted = true} - rabbit
    try {
      updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId },
        { $set: { isStarted: true } },
        { new: true }
      );
    } catch (error) {
      console.error('Error starting order:', error);
      res.status(500).send('Internal server error');
    }
    if (updatedOrder) {
      console.log("making payment for order after timeout")
      makePayment(orderId, payload, res, updatedOrder);
    }
  }
};
export const putOrdersRoute = async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).send('Invalid order ID');
    return;
  }
  const orderId = new mongoose.Types.ObjectId(req.params.id);
  const updates = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }

    Object.keys(updates).forEach((key) => {
      order[key] = updates[key];
    });
    //next event:
    await order.save();
    const obj = { username: order.username, eventId: order.eventID, eventTitle: order.eventTitle, eventStartDate: order.eventStartDate };
    produceMessage("user-nextEvent-put-queue", obj);
    res.status(200).send('Order updated');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating order');
  }
}
export const deleteOrdersRoute = async (req: Request, res: Response) => {
  console.log("delete order", req.params.id)
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).send('Invalid order ID');
    return;
  }
  const orderId = new mongoose.Types.ObjectId(req.params.id);
  let order;
  try {
    order = await Order.findById(orderId);
    if (!order) {
      res.status(404).send('Order not found');
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('internal server error');
    return;
  }

  // const eventRes = await servicesApi.getEvent(order.eventID);
  // if (eventRes.error) {
  //   res.status(500).send("Internal server error");
  //   return;
  // }
  // const event = eventRes.data;

  // if (event.start_date < new Date()) {
  //   return res.status(400).send('Cannot delete order for an event that has already happened');
  // }

  const order_eventID = order.eventID;
  const order_ticketType = order.ticketType;
  const order_quantity = order.quantity;
  try {
    await order.deleteOne();
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
  // TODO: increment tickets number in event using Rabbit MQ: V
  const obj = { eventID: order_eventID, ticketType: order_ticketType, quantity: order_quantity }
  produceMessage("event-tickets-queue", obj)
  //next Event update:
  const objToNextEvent = { username: order.username, eventId: order.eventID };
  produceMessage("user-nextEvent-delete-queue", objToNextEvent);
  // TODO: refund money:
  let res_refund;
  try {
    res_refund = await refund({ orderId: orderId })
  } catch (e) {
    const obj = { orderId: orderId }
    produceMessage("order-refund-queue", obj);
  }
  res.status(200).send('Order deleted');
}


export const getNextEventRoute = async (req: Request, res: Response) => {
  console.log("getNextEventRoute")
  const username = req.params.id;
  const orders = await Order.find({ username: username });
  // console.log(orders)
  const now = new Date();
  if (orders.length == 0) {
    res.status(200).send("");
    return;
  }
  let nextEventTitle = "";
  let nextEventDate;
  let nextEventId;
  orders.forEach((order) => {
    if (order.isPaid) {
      const OrderEventStartDate = order.eventStartDate
      // console.log(OrderEventStartDate)
      if (nextEventDate) {
        if (OrderEventStartDate < nextEventDate && now < OrderEventStartDate) {
          nextEventTitle = order.eventTitle
          nextEventDate = OrderEventStartDate
          nextEventId = order.eventID
        }
      }
      else {
        if (now < OrderEventStartDate) {
          nextEventTitle = order.eventTitle
          nextEventDate = OrderEventStartDate
          nextEventId = order.eventID
        }
      }
    }
    //{eventId: XXX, eventTitle: XXX, eventStartDate: XXX }
  });
  res.status(200).send({ eventId: nextEventId, eventTitle: nextEventTitle, eventStartDate: nextEventDate });
  return;
}

// Utility functions

const makePayment = async (orderId: mongoose.Types.ObjectId, payload: PaymentPayload, res: Response, order: any) => {
  try {
    await processPayment(payload);
  }
  catch (e) {
    console.error('Error making payment:', e);
    res.status(500).send('Error making payment');
    // delete order - rabbit: V
    const objorderId = { orderId: order._id }
    produceMessage("order-delete-queue", objorderId);
    // increment tickets using rabbit
    const obj = { eventID: order.eventID, ticketType: order.ticketType, quantity: order.quantity }
    produceMessage("event-tickets-queue", obj);
    return;
  }

  res.status(200).send('Payment successful');

  // TODO: put order {isPaid = true} - rabbit 
  try {
    await Order.findOneAndUpdate(
      { _id: orderId },
      { $set: { isPaid: true } },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating order to paid:', error);
    res.status(500).send('Error updating order to paid');
  }


  // update next event for user
  try {
    const obj = { username: order.username, eventId: order.eventID, eventTitle: order.eventTitle, eventStartDate: order.eventStartDate };
    produceMessage("user-nextEvent-post-queue", obj);
  } catch (error) {
    console.error('Error producing message:', error);
    // Handle the error as needed, e.g., log it, notify the user, etc.
  }

}

const initiateTimedCheckout = async (orderId: mongoose.Types.ObjectId, event_id: string, ticketType: string, quantity: number) => {
  // Wait for 2 minutes
  console.log("==> timer started");
  await new Promise(resolve => setTimeout(resolve, 140 * 1000));
  console.log("==> timer ended");

  let updatedOrder;
  try {
    // Atomically check the isStarted field and delete the order
    updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, isStarted: false },
      { $set: { isTimedOut: true } },
      { new: true } // Return the modified document
    );
  } catch (error) {
    console.error('internal server error', error);
    return;
  }
  console.log("updated order after timeout", updatedOrder);

  // increment tickets using rabbit: 
  if (updatedOrder) {
    console.log("order is marked as timeout, increasing tickets availability")
    const obj = { eventID: event_id, ticketType: ticketType, quantity: quantity }
    console.log(obj)
    produceMessage("event-tickets-queue", obj);
  }
};

