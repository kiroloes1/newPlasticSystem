const ReturnDelivery = require(`${__dirname}/../../models/returnDelivery`);
const Supplier = require(`${__dirname}/../../models/supplier`);
const Admin = require(`${__dirname}/../../models/users`);
const Item = require(`${__dirname}/../../models/fixedCategoryModel`);
const TransactionModel=require(`${__dirname}/../../models/TransactionBox`);
const mongoose = require('mongoose');

// create
exports.createReturnDelivery = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { supplier, items, notes } = req.body;
        const adminId = req.user.userId;

        if (!supplier || !items || items.length === 0) {
            throw new Error("المورد والأصناف مطلوبين");
        }

        const supplierExists = await Supplier.findById(supplier).session(session);
        if (!supplierExists) throw new Error("المورد غير موجود");

        let totalAmount = 0;

        for (const item of items) {
            let totalWeight = 0;

            for (const batch of item.batches) {
                if (batch.weight < 0 || batch.quantity <= 0) {
                    throw new Error("Invalid batch");
                }
                totalWeight += batch.weight * batch.quantity;
            }

            const totalPrice = totalWeight * item.pricePerKg;

            item.totalReturnWeight = totalWeight;
            item.totalReturnPrice = totalPrice;

            totalAmount += totalPrice;
        }

        const returnDelivery = await ReturnDelivery.create([{
            supplier,
            receivedBy: adminId,
            items,
            totalAmount,
            notes
        }], { session });

        
        supplierExists.remainingBalance -= totalAmount;

        supplierExists.transactions.push({
            type: "return",
            deliveryId: returnDelivery[0]._id,
            totalAmount,
            paid: 0,
            remainingBalance: supplierExists.remainingBalance,
            note: "Return delivery",
            date: new Date()
        });

        await supplierExists.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: "تم إنشاء المرتجع بنجاح",
            returnDelivery: returnDelivery[0]
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: err.message });
    }
};

// update
exports.updateReturnDelivery = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("ID غير صحيح");
        }

        const oldReturn = await ReturnDelivery.findById(id).session(session);
        if (!oldReturn) throw new Error("المرتجع غير موجود");

        const supplier = await Supplier.findById(oldReturn.supplier).session(session);

        // rollback القديم
        supplier.remainingBalance += oldReturn.totalReturnPrice;

        supplier.transactions = supplier.transactions.filter(
            t => t.deliveryId.toString() !== id
        );

        // recalculation
        let totalAmount = 0;

        for (const item of updates.items) {
            let totalWeight = 0;

            for (const batch of item.batches) {
                totalWeight += batch.weight * batch.quantity;
            }

            const totalPrice = totalWeight * item.pricePerKg;

            item.totalReturnWeight = totalWeight;
            item.totalReturnPrice = totalPrice;

            totalAmount += totalPrice;
        }

        // apply الجديد
        supplier.remainingBalance -= totalAmount;

        supplier.transactions.push({
            type: "return",
            deliveryId: id,
            totalAmount,
            remainingBalance: supplier.remainingBalance,
            note: "Updated return",
            date: new Date()
        });

        await supplier.save({ session });

        const updated = await ReturnDelivery.findByIdAndUpdate(
            id,
            { ...updates, totalAmount },
            { new: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: "تم التعديل بنجاح",
            returnDelivery: updated
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: err.message });
    }
};

// delete
exports.deleteReturnDelivery = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const oldReturn = await ReturnDelivery.findById(id).session(session);
        if (!oldReturn) throw new Error("غير موجود");

        const supplier = await Supplier.findById(oldReturn.supplier).session(session);

        // rollback
        supplier.remainingBalance += oldReturn.totalReturnPrice;

        supplier.transactions = supplier.transactions.filter(
            t => t.deliveryId.toString() !== id
        );

        await supplier.save({ session });

        await ReturnDelivery.findByIdAndDelete(id, { session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "تم الحذف بنجاح" });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: err.message });
    }
};

// get all
exports.getAllReturnDeliveries = async (req, res) => {
    try {
        const data = await ReturnDelivery.find()
            .populate("supplier", "name")
            .populate("receivedBy", "username")
            .populate("items.item", "name")
            .sort({ createdAt: -1 });

        res.json({
            results: data.length,
            data
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// getReturnById
exports.getReturnById = async (req, res) => {
    try {
        const { id } = req.params;

        const data = await ReturnDelivery.findById(id)
            .populate("supplier", "name")
            .populate("receivedBy", "username")
            .populate("items.item", "name");

        if (!data) return res.status(404).json({ message: "غير موجود" });

        res.json({ data });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


//  getReturnBySupplier
exports.getReturnBySupplier = async (req, res) => {
    try {
        const { supplierId } = req.params;

        const data = await ReturnDelivery.find({ supplier: supplierId })
            .populate("supplier", "name")
            .populate("receivedBy", "username")
            .populate("items.item", "name")
            .sort({ createdAt: -1 });

        res.json({
            results: data.length,
            data
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
