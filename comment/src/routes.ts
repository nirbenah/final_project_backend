
import { Request, Response } from 'express';
import Comment from './models/Comment.js';
import amqp from 'amqplib'


export const getCommentsRoute = async (req: Request, res: Response) => {
  console.log(req.query)
  const { page, limit, event_id } = req.query as { page?: string, limit?: string, event_id?: string };
  const real_limit: number = parseInt(limit || '0', 10)
  const start_index: number = (parseInt(page || '1', 10) - 1) * real_limit // if page is 0 / null / undefined... it becomes '1', the 10 just indicates "decimal"
  let comments;
  let total = 0;
  try {
    if (event_id) {
      if (!limit) {
        comments = await Comment.find({ event_id: event_id }).sort({ date: -1 });
      } else {
        comments = await Comment.find({ event_id: event_id }).sort({ date: -1 }).skip(start_index).limit(real_limit);
      }
    }
    total = await Comment.countDocuments({ event_id: event_id });
  }
  catch (e) {
    res.status(500).send('Error fetching comments');
    return;
  }
  res.status(200).send({ comments: comments, total: total });
  return;
}

export const postCommentRoute = async (req: Request, res: Response) => {
  const comment = new Comment(req.body);
  console.log("new Comment")
  try {
    const error = await comment.validate();
  }
  catch (error) {
    res.status(400).send('Invalid comment format');
    return;
  }
  try {
    await comment.save();
  }
  catch (e) {
    res.status(500).send('Error creating comment');
    return;
  }

  const event_id = req.body.event_id
  const obj = {event_id}
  produceMessage("event-comments-queue", obj);

  res.status(201).send('Comment created');
}


let order, channel, connection;
const amqpServerUrl = 'amqps://jddswdas:q7Z2M-xcXHpB_-_XKdMbWAQ2uqmUW6ay@shark.rmq.cloudamqp.com/jddswdas'

async function connectToRabbitMQ() {
  connection = await amqp.connect(amqpServerUrl);
  channel = await connection.createChannel();
}
connectToRabbitMQ();


export async function produceMessage(queueName: string,  obj: any) {
  console.log("produceMessage was called")
  if(!channel){
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