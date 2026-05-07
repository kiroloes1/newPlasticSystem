const ReturnDelivery = require(`../../models/returnDelivery`);

exports.getReturnReport = async (req, res) => {
  try {

    const { filter, startDate, endDate } = req.query;

    const now = new Date();

    let dateMatch = {};

    // DAILY
    if (filter === "daily") {
      const start = new Date();
      start.setHours(0,0,0,0);

      const end = new Date();
      end.setHours(23,59,59,999);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    // MONTHLY
    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth()+1, 0);

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

      // 4. group per return delivery
      {
        $group: {

          _id: "$_id",

          totalAmount: { $first: "$totalAmount" },

          itemsCount: { $sum: 1 },

          totalWeight: {
            $sum: "$items.batches.weight"
          }

        }
      },

      // 5. final aggregation
      {
        $group: {

          _id: null,

          totalReturns: { $sum: 1 },

          totalReturnAmount: { $sum: "$totalAmount" },

          totalReturnWeight: { $sum: "$totalWeight" },

          totalItems: { $sum: "$itemsCount" }

        }
      }

    ]);

    res.json({
      success: true,
      report: report[0] || {}
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};