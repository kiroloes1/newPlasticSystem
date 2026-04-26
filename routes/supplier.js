const express = require("express");
const router = express.Router();
const authMiddleware = require(`${__dirname}/../middlewares/authMiddleware`);
const supplierController = require(`${__dirname}/../controller/supplier`);
const {role}= require(`${__dirname}/../middlewares/authorization`) 



// protected routes
router.use(authMiddleware.protected);
router.use(role('superadmin', 'manager')); // only admin and manager can access these routes
// ========================== ROUTES ==========================



// GET all suppliers
router.get("/", supplierController.getAllSuppliers);

// GET supplier by ID
router.get("/:id", supplierController.getSupplierById);

// CREATE new supplier
router.post("/", supplierController.createNewSupplier);

// UPDATE supplier
router.put("/:id", supplierController.updateSupplier);


// ADD to supplier balance (debt)

router.patch("/addDebt/:id", supplierController.addDebt);


// ADD to supplier balance (payment)
router.patch("/paySupplier/:id", supplierController.paySupplier);


// FILTER suppliers by search query
router.get("/filter/search", supplierController.filterSuppliers);


module.exports = router;