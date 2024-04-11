import * as mongoose from "mongoose";
import { CATEGORY_TYPES } from "../const.js";
import Joi from "joi";

const ticketSchema = new mongoose.Schema({
    name: String,
    quantity: Number,
    price: Number,
    available: Number,
}, { _id: false });

const eventSchema = new mongoose.Schema({
    title: String,
    category: String,
    description: String,
    organizer: String,
    start_date: Date,
    end_date: Date,
    location: String,
    tickets: [ticketSchema],
    tickets_available: { type: Number, default: 0 },
    min_price: { type: Number, default: 0 },
    image: String,
    commentsNumber: { type: Number, default: 0 }
});

eventSchema.index({ start_date: -1});


export const eventJoiSchema = Joi.object({
    title: Joi.string().required(),
    category: Joi.string().valid(...CATEGORY_TYPES).required(),
    description: Joi.string().required(),
    organizer: Joi.string().required(),
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
    location: Joi.string().required(),
    tickets: Joi.array()
        .items(
            Joi.object({
                name: Joi.string().required(),
                quantity: Joi.number().min(0).required(),
                price: Joi.number().min(0).required(),
                available: Joi.number().min(0),
            })
        )
        .min(1)
        .required()
        .unique((a, b) => a.name === b.name)
        .error(
            new Error('Tickets must be an array of at least one ticket.')
        ),
    tickets_available: Joi.number().default(0),
    min_price: Joi.number().default(0),
    image: Joi.string().allow(''),
    commentsNumber: Joi.number().default(0),
})
    .options({ abortEarly: false, allowUnknown: true });

export default mongoose.model('Event', eventSchema);
