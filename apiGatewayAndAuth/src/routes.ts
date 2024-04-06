import { Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import { produceMessage } from './rabbitmq.js';

export async function loginRoute(req: Request, res: Response) {
  const credentials = req.body;
  try {
    await User.validate(credentials);
  }
  catch (e) {
    res.status(400).send('invalid user format - should not happen');
    return;
  }

  let user;

  try {
    user = await User.findOne({ username: credentials.username });
  }
  catch (e) {
    res.status(500).send('Internal server error');
    return;
  }

  if (!user || !await bcrypt.compare(credentials.password, user.password)) {
    res.status(401).send('Invalid credentials');
    return;
  }

  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '2d' })

  // TODO: does it need to be secure?
  // const secure = process.env.NODE_ENV === 'production';

  const cookieName = 'token';
  const cookieValue = token;
  res.cookie(cookieName, cookieValue, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 1000 * 60 * 60 * 24 * 2 });

  res.status(200).send(user.permission);
}

export async function logoutRoute(req: Request, res: Response) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieName = 'token';
  // clear cookie value
  const cookieValue = '';
  res.cookie(cookieName, cookieValue, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 1000 * 60 * 60 * 24 * 2 });
  res.status(200).send('Logged out');
}

export async function signupRoute(req: Request, res: Response) {
  const user = new User(req.body);
  user.permission = 'U';
  console.log("I'm signing up")
  try {
    await user.validate();
  }
  catch (e) {
    console.log("not suppose to show this since credentials are checked in the front", e);
    res.status(400).send('Invalid credentials');
    return;
  }
  if (await User.exists({ username: user.username })) {
    res.status(400).send('Username already exists');
    return;
  }

  user.password = await bcrypt.hash(user.password, 10);

  try {
    await user.save();
  }
  catch (e) {
    res.status(500).send('Error creating user');
    return;
  }

  res.status(201).send('User created');
}

export async function getUserInfoFromCookie(req: Request, res: Response) {
  const token = req.cookies.token;
  console.log(req.cookies.token);
  if (!token) {
    res.status(401).send('Not logged in');
    return;
  }

  let username, permission;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    username = (payload as JwtPayload).username;
  }
  catch (e) {
    res.status(401).send('Invalid token');
    return;
  }

  try {
    const user = await User.findOne({ username: username });
    permission = user.permission;
  } catch (e) {
    res.status(500).send('Internal server error');
    return;
  }

  res.status(200).send({ username, permission });
}

export const updatePermissionRoute = async (req: Request, res: Response) => {
  const username = req.body.username;
  const permission = req.body.permission;
  console.log(username, permission);
  if (permission !== 'M' && permission !== 'W' && permission !== 'U') {
    res.status(400).send('Invalid permission level');
    return;
  }

  let updatedUser;
  try {
    updatedUser = await User.findOneAndUpdate({ username: username }, { permission: permission }, { new: true });
  }
  catch (e) {
    console.log(e);
    res.status(500).send('Error updating permission');
    return;
  }

  if (!updatedUser) {
    res.status(400).send('Username does not exist');
    return;
  }

  res.status(200).send('Permission updated');
}

export const getUserNextEventRoute = async (req: Request, res: Response) => {
  const username = req.params.id;
  let user;
  try {
    user = await User.findOne({ username: username });
    if(!user) {
      console.log("Username does not exist");
      res.status(400).send('Username does not exist');
      return;
    }
    if(user.nextEventId && user.nextEventId !== "" && user.nextEventDate < new Date()) {
      // call rabbitmq to update next event
      const obj = { username: username, eventId: "", eventTitle: "", eventStartDate: "" };
      produceMessage("user-nextEvent-put-queue", obj);
    }
  } catch (e) {
    console.log(e);
    res.status(500).send('Internal server error');
    return;
  }
  const nextEventDate = user.nextEventDate ? user.nextEventDate : "";
  const nextEventTitle = user.nextEventTitle ? user.nextEventTitle : "";
  res.status(200).send({ eventTitle: nextEventTitle, eventStartDate: nextEventDate });

}




