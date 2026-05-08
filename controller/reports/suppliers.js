const Supplier = require("../../models/supplier");

exports.getSupplierFinanceReport = async (req, res) => {
  try {

    const { filter, startDate, endDate } = req.query;

    const now = new Date();

    let dateMatch = {};

    // ========== DATE FILTER ==========
    if (filter === "daily") {
      const start = new Date();
      start.setHours(0,0,0,0);

      const end = new Date();
      end.setHours(23,59,59,999);

      dateMatch = { "transactions.date": { $gte: start, $lte: end } };
    }

    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth()+1, 0);

      dateMatch = { "transactions.date": { $gte: start, $lte: end } };
    }

    else if (filter === "yearly") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);

      dateMatch = { "transactions.date": { $gte: start, $lte: end } };
    }

    else if (filter === "custom") {
      dateMatch = {
        "transactions.date": {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // ========== AGGREGATION ==========
    const report = await Supplier.aggregate([

      // 1. unwind transactions
      { $unwind: "$transactions" },

      // 2. filter by date
      { $match: dateMatch },

      // 3. group per supplier
      {
        $group: {

          _id: "$_id",
          name: { $first: "$name" },
          phone: { $first: "$phone" },

          // ========== DELIVERY TOTAL ==========
          totalPurchases: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "delivery"] },
                "$transactions.totalAmount",
                0
              ]
            }
          },

          // ========== RETURNS TOTAL ==========
          totalReturns: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "return"] },
                "$transactions.totalAmount",
                0
              ]
            }
          },

          // ========== PAID ==========
          totalPaid: {
            $sum: "$transactions.paid"
          },

          // ========== PAYMENT BREAKDOWN ==========
          payments: { $push: "$transactions.payment" },

          // ========== REAL CURRENT DEBT ==========
          currentDebt: { $first: "$remainingBalance" }

        }
      },

      // 4. FINAL CALCULATION
      {
        $project: {

          name: 1,
          phone: 1,

          totalPurchases: 1,
          totalReturns: 1,

          // NET PURCHASES (IMPORTANT)
          netPurchases: {
            $subtract: ["$totalPurchases", "$totalReturns"]
          },

          totalPaid: 1,
          currentDebt: 1,

          // ========== PAYMENT METHODS ==========
          cash: {
            $reduce: {
              input: "$payments",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $sum: {
                      $map: {
                        input: "$$this",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.paymentMethod", "cash"] },
                            "$$p.paidAmount",
                            0
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },

          wallet: {
            $reduce: {
              input: "$payments",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $sum: {
                      $map: {
                        input: "$$this",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.paymentMethod", "wallet"] },
                            "$$p.paidAmount",
                            0
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },

          instapay: {
            $reduce: {
              input: "$payments",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $sum: {
                      $map: {
                        input: "$$this",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.paymentMethod", "instapay"] },
                            "$$p.paidAmount",
                            0
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },

          bank: {
            $reduce: {
              input: "$payments",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $sum: {
                      $map: {
                        input: "$$this",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.paymentMethod", "bank"] },
                            "$$p.paidAmount",
                            0
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },

          work: {
            $reduce: {
              input: "$payments",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $sum: {
                      $map: {
                        input: "$$this",
                        as: "p",
                        in: {
                          $cond: [
                            { $eq: ["$$p.paymentMethod", "work"] },
                            "$$p.paidAmount",
                            0
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }

        }
      },

      // 5. SORT BY DEBT
      {
        $sort: { currentDebt: -1 }
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
