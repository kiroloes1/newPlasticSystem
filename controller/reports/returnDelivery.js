const ReturnDelivery = require(`${__dirname}/../../models/returnDelivery`);

exports.getReturnReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const now = new Date();

    let dateMatch = {};

    // DAILY
    if (filter === "daily") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    // MONTHLY
    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    // YEARLY
    else if (filter === "yearly") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    // CUSTOM
    else if (filter === "custom") {
      dateMatch = {
        deliveryDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const report = await ReturnDelivery.aggregate([

      // 1. filter by date
      { $match: dateMatch },

      // 2. unwind items
      { $unwind: "$items" },

      // 3. unwind batches
      { $unwind: "$items.batches" },

      // 4. group by item (product level)
      {
        $group: {
          _id: {
            returnId: "$_id",
            itemName: "$items.name"
          },

          totalWeight: { $sum: "$items.batches.weight" },
          count: { $sum: 1 },
          totalAmount: { $first: "$totalAmount" }
        }
      },

      // 5. group per return document
      {
        $group: {
          _id: "$_id.returnId",

          totalAmount: { $first: "$totalAmount" },
          itemsCount: { $sum: "$count" },
          totalWeight: { $sum: "$totalWeight" },

          items: {
            $push: {
              name: "$_id.itemName",
              weight: "$totalWeight",
              count: "$count"
            }
          }
        }
      },

      // 6. final summary
      {
        $group: {
          _id: null,

          totalReturns: { $sum: 1 },
          totalReturnAmount: { $sum: "$totalAmount" },
          totalReturnWeight: { $sum: "$totalWeight" },
          totalItems: { $sum: "$itemsCount" },

          products: {
            $push: "$items"
          }
        }
      }

    ]);

    res.json({
      success: true,
      report: report[0] || {
        totalReturns: 0,
        totalReturnAmount: 0,
        totalReturnWeight: 0,
        totalItems: 0,
        products: []
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
