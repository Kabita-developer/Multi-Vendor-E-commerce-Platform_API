const mongoose = require('mongoose');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const VendorWallet = require('../../Commission_Calculation/models/VendorWallet');

/**
 * Request withdrawal
 * POST /api/vendor/wallet/withdraw
 */
async function requestWithdrawal(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const vendorId = req.vendorId; // From middleware

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be a number',
      });
    }

    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Withdrawal amount must be greater than 0',
      });
    }

    // Round to 2 decimal places
    const withdrawalAmount = Math.round(amount * 100) / 100;

    // Fetch vendor wallet by vendorId
    let wallet = await VendorWallet.findOne({ vendorId: new mongoose.Types.ObjectId(vendorId) }).session(session);

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await VendorWallet.create(
        [
          {
            vendorId: new mongoose.Types.ObjectId(vendorId),
            balance: 0,
            holdBalance: 0,
            transactions: [],
          },
        ],
        { session },
      );
      wallet = wallet[0];
    }

    // Check if wallet.balance >= amount
    if (wallet.balance < withdrawalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available balance: ${wallet.balance.toFixed(2)}`,
      });
    }

    // Create WithdrawalRequest with status = "PENDING"
    const withdrawalRequest = await WithdrawalRequest.create(
      [
        {
          vendorId: new mongoose.Types.ObjectId(vendorId),
          amount: withdrawalAmount,
          status: 'PENDING',
          requestedAt: new Date(),
        },
      ],
      { session },
    );

    // Update wallet: balance -= amount, holdBalance += amount
    wallet.balance = Math.round((wallet.balance - withdrawalAmount) * 100) / 100;
    wallet.holdBalance = Math.round((wallet.holdBalance + withdrawalAmount) * 100) / 100;

    // Add transaction record
    wallet.transactions.push({
      type: 'DEBIT',
      amount: withdrawalAmount,
      description: `Withdrawal request - Amount held (Request ID: ${withdrawalRequest[0]._id})`,
    });

    await wallet.save({ session });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        requestId: withdrawalRequest[0]._id,
        amount: withdrawalAmount,
        status: 'PENDING',
        availableBalance: wallet.balance,
        holdBalance: wallet.holdBalance,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in requestWithdrawal:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit withdrawal request',
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  requestWithdrawal,
};

