
import * as mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    event_id: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: Date, required: true },
    content: { type: String, required: true }
}, {id: false});

//export default mongoose.model('modelName', Schema, 'collectionNa,e');
export default mongoose.model('Comment', commentSchema, 'comments');
