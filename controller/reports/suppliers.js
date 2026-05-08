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

      dateMatch = { "transactions.date": { $gte: start, $lte: end } };
    }

    else if (filter === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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

    // ================= AGGREGATION =================
    const report = await Supplier.aggregate([

      { $unwind: "$transactions" },

      { $match: dateMatch },

      {
        $group: {

          _id: "$_id",
          name: { $first: "$name" },
          phone: { $first: "$phone" },

          // ================= PURCHASES =================
          totalPurchases: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "delivery"] },
                "$transactions.totalAmount",
                0
              ]
            }
          },

          // ================= RETURNS =================
          totalReturns: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "return"] },
                "$transactions.totalAmount",
                0
              ]
            }
          },

          // ================= PAID =================
          totalPaid: {
            $sum: "$transactions.paid"
          },

          // ================= PAYMENT HISTORY =================
          payments: { $push: "$transactions.payment" },

          // ================= DEBT FROM TRANSACTIONS =================
          totalDebtFromTransactions: {
            $sum: "$transactions.remainingBalance"
          },

          // ================= CURRENT REAL DEBT =================
          currentDebt: { $first: "$remainingBalance" }

        }
      },

      {
        $project: {

          name: 1,
          phone: 1,

          totalPurchases: 1,
          totalReturns: 1,

          // ================= NET PURCHASES =================
          netPurchases: {
            $subtract: ["$totalPurchases", "$totalReturns"]
          },

          totalPaid: 1,

          totalDebtFromTransactions: 1,
          currentDebt: 1,

          // ================= CASH =================
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
                            {
                              $and: [
                                { $eq: ["$$p.paymentMethod", "cash"] },
                                { $eq: ["$$p.paymentType", "payment"] }
                              ]
                            },
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

          // ================= WALLET =================
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
                            {
                              $and: [
                                { $eq: ["$$p.paymentMethod", "wallet"] },
                                { $eq: ["$$p.paymentType", "payment"] }
                              ]
                            },
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

          // ================= INSTAPAY =================
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
                            {
                              $and: [
                                { $eq: ["$$p.paymentMethod", "instapay"] },
                                { $eq: ["$$p.paymentType", "payment"] }
                              ]
                            },
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

          // ================= BANK =================
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
                            {
                              $and: [
                                { $eq: ["$$p.paymentMethod", "bank"] },
                                { $eq: ["$$p.paymentType", "payment"] }
                              ]
                            },
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

          // ================= WORK =================
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
                            {
                              $and: [
                                { $eq: ["$$p.paymentMethod", "work"] },
                                { $eq: ["$$p.paymentType", "payment"] }
                              ]
                            },
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
