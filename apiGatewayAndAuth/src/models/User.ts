
import * as mongoose from 'mongoose';


// const miniOrderSchema = new mongoose.Schema({
//     username: String,
//     eventId: String,
//     eventTitle: String,
//     eventStartDate: Date,
// }, { _id: false });


const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    permission: { type: String, required: false },
    nextEventId: { type: String, required: false, default: "" },
    nextEventTitle: { type: String, required: false, default: "" },
    nextEventDate: { type: Date, required: false},
}, {id: false});

// userSchema.path('arrayOfEvents').required(false);

export default mongoose.model('User', userSchema, 'users');

