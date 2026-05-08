const Supplier = require(`${__dirname}/../../models/supplier`);

exports.getSuppliersReport = async (req, res) => {
  try {

    let { filter, startDate, endDate } = req.query;

    let dateFilter = {};

    const now = new Date();

    // Daily
    if (filter === "daily") {

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        "transactions.date": {
          $gte: start,
          $lte: end
        }
      };
    }

    // Monthly
    else if (filter === "monthly") {

      const start = new Date(now.getFullYear(), now.getMonth(), 1);

      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        "transactions.date": {
          $gte: start,
          $lte: end
        }
      };
    }

    // Yearly
    else if (filter === "yearly") {

      const start = new Date(now.getFullYear(), 0, 1);

      const end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        "transactions.date": {
          $gte: start,
          $lte: end
        }
      };
    }

    // Custom Range
    else if (filter === "custom" && startDate && endDate) {

      dateFilter = {
        "transactions.date": {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const report = await Supplier.aggregate([

  
      {
        $unwind: "$transactions"
      },


      {
        $match: dateFilter
      },


      {
        $group: {

          _id: "$_id",

          supplierName: {
            $first: "$name"
          },

          phone: {
            $first: "$phone"
          },


          totalDeliveriesAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "delivery"] },
                "$transactions.totalAmount",
                0
              ]
            }
          },

          totalPaid: {
            $sum: "$transactions.paid"
          },

          totalRemaining: {
            $first: "remainingBalance"
          },


          deliveriesCount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "delivery"] },
                1,
                0
              ]
            }
          },


          returnsCount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "return"] },
                1,
                0
              ]
            }
          }

        }
      },


      {
        $sort: {
          totalDeliveriesAmount: -1
        }
      }

    ]);

    res.status(200).json({
      success: true,
      count: report.length,
      report
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
