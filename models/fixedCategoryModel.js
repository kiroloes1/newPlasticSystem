const mongoose = require('mongoose');

const fixedCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    pricePerWeight:{
      type:Number,
      
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, { timestamps: true });

module.exports = mongoose.model('FixedCategory', fixedCategorySchema);