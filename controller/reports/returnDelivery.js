const ReturnDelivery = require(`../../models/returnDelivery`);

exports.getReturnReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const now = new Date();

    let dateMatch = {};

    // DATE FILTERS
    if (filter === "daily") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    else if (filter === "yearly") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);

      dateMatch = { deliveryDate: { $gte: start, $lte: end } };
    }

    else if (filter === "custom") {
      dateMatch = {
        deliveryDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const report = await ReturnDelivery.aggregate([

      { $match: dateMatch },

      // flatten items
      { $unwind: "$items" },

      // flatten batches
      { $unwind: "$items.batches" },

      // lookup item details
      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemInfo"
        }
      },

      { $unwind: "$itemInfo" },

      // GROUP BY ITEM
      {
        $group: {
          _id: "$items.item",

          name: { $first: "$itemInfo.name" },

          totalWeight: { $sum: "$items.batches.weight" },

          totalQuantity: { $sum: "$items.batches.quantity" },

          totalValue: {
            $sum: {
              $multiply: [
                "$items.batches.weight",
                "$itemInfo.pricePerWeight"
              ]
            }
          }
        }
      },

      // FINAL GROUP (SUMMARY + ITEMS)
      {
        $group: {
          _id: null,

          totalItems: { $sum: 1 },

          totalWeight: { $sum: "$totalWeight" },

          totalValue: { $sum: "$totalValue" },

          items: {
            $push: {
              name: "$name",
              weight: "$totalWeight",
              quantity: "$totalQuantity",
              value: "$totalValue"
            }
          }
        }
      }

    ]);

    res.json({
      success: true,
      report: report[0] || {
        totalItems: 0,
        totalWeight: 0,
        totalValue: 0,
        items: []
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
