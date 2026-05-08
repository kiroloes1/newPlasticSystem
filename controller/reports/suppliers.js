const Supplier = require(`${__dirname}/../../models/supplier`);

exports.getSuppliersReport = async (req, res) => {
  try {

    const { filter, startDate, endDate } = req.query;

    const now = new Date();

    let dateMatch = {};

    // ================= DATE FILTER =================
    if (filter === "daily") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      dateMatch = { "paymentHistory.date": { $gte: start, $lte: end } };
    }

    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      dateMatch = { "paymentHistory.date": { $gte: start, $lte: end } };
    }

    else if (filter === "yearly") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);

      dateMatch = { "paymentHistory.date": { $gte: start, $lte: end } };
    }

    else if (filter === "custom") {
      dateMatch = {
        "paymentHistory.date": {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // ================= AGGREGATION =================
    const report = await Supplier.aggregate([

      { $unwind: "$paymentHistory" },

      { $match: dateMatch },

      {
        $group: {

          _id: "$_id",
          name: { $first: "$name" },
          phone: { $first: "$phone" },

          // ================= TOTAL PAYMENTS =================
          totalPayments: {
            $sum: {
              $cond: [
                { $eq: ["$paymentHistory.type", "payment"] },
                "$paymentHistory.amount",
                0
              ]
            }
          },

          // ================= TOTAL DEBT =================
          totalDebt: {
            $sum: {
              $cond: [
                { $eq: ["$paymentHistory.type", "debt"] },
                "$paymentHistory.amount",
                0
              ]
            }
          },

          // ================= ALL PAYMENTS =================
          payments: { $push: "$paymentHistory" }

        }
      },

      {
        $project: {

          name: 1,
          phone: 1,

          totalPayments: 1,
          totalDebt: 1,

          // ================= CASH =================
          cash: {
            $sum: {
              $map: {
                input: "$payments",
                as: "p",
                in: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$$p.type", "payment"] },
                        { $eq: ["$$p.paymentMethod", "cash"] }
                      ]
                    },
                    "$$p.amount",
                    0
                  ]
                }
              }
            }
          },

          // ================= WALLET =================
          wallet: {
            $sum: {
              $map: {
                input: "$payments",
                as: "p",
                in: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$$p.type", "payment"] },
                        { $eq: ["$$p.paymentMethod", "wallet"] }
                      ]
                    },
                    "$$p.amount",
                    0
                  ]
                }
              }
            }
          },

          // ================= BANK TRANSFER =================
          bank: {
            $sum: {
              $map: {
                input: "$payments",
                as: "p",
                in: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$$p.type", "payment"] },
                        { $eq: ["$$p.paymentMethod", "bank transfer"] }
                      ]
                    },
                    "$$p.amount",
                    0
                  ]
                }
              }
            }
          },

          // ================= INSTAPAY =================
          instapay: {
            $sum: {
              $map: {
                input: "$payments",
                as: "p",
                in: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$$p.type", "payment"] },
                        { $eq: ["$$p.paymentMethod", "instapay"] }
                      ]
                    },
                    "$$p.amount",
                    0
                  ]
                }
              }
            }
          },

          // ================= WORK =================
          work: {
            $sum: {
              $map: {
                input: "$payments",
                as: "p",
                in: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$$p.type", "payment"] },
                        { $eq: ["$$p.paymentMethod", "work"] }
                      ]
                    },
                    "$$p.amount",
                    0
                  ]
                }
              }
            }
          }

        }
      },

      {
        $sort: { totalDebt: -1 }
      }

    ]);

    res.json({
      success: true,
      count: report.length,
      report
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
