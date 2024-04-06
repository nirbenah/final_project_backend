
import * as mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    username: { type: String, required: true },
    eventID: { type: String, required: true },
    eventTitle: { type: String, required: true },
    eventStartDate: { type: Date, required: true },
    ticketType: { type: String, required: true },
    orderDate: { type: Date, required: true },
    quantity: { type: Number, required: true },
    pricePerTicket: { type: Number, required: true },
    isPaid: {type: Boolean, required: true},
    isStarted: {type: Boolean, required: true},
    isTimedOut: {type: Boolean, required: true},
}, {id: false});

//export default mongoose.model('modelName', Schema, 'collectionName');
export default mongoose.model('Order', orderSchema, 'orders');
