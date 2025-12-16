const mongoose = require('mongoose');
const WithdrawalRequest = require('../../Vendor_Withdrawal_Request/models/WithdrawalRequest');
const VendorWallet = require('../../Commission_Calculation/models/VendorWallet');

/**
 * Process vendor payout (settlement)
 * POST /api/admin/settlements/:vendorId/pay
 */
async function processSettlement(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vendorId } = req.params;
    const { withdrawalRequestId, paymentReference } = req.body;
    const user = req.user; // From middleware (id, role, email)

    // Validate vendorId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format',
      });
    }

    // Validate withdrawalRequestId
    if (!withdrawalRequestId || !mongoose.Types.ObjectId.isValid(withdrawalRequestId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid withdrawal request ID is required',
      });
    }

    // Validate paymentReference
    if (!paymentReference || typeof paymentReference !== 'string' || paymentReference.trim().length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required',
      });
    }

    // Fetch WithdrawalRequest by withdrawalRequestId
    const withdrawal = await WithdrawalRequest.findById(withdrawalRequestId).session(session);

    // If not found → return error
    if (!withdrawal) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found',
      });
    }

    // Ensure withdrawal.status === "PENDING"
    if (withdrawal.status !== 'PENDING') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Withdrawal request is already ${withdrawal.status}. Only PENDING requests can be paid.`,
      });
    }

    // Ensure withdrawal.vendorId matches :vendorId
    if (withdrawal.vendorId.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Withdrawal request does not belong to this vendor',
      });
    }

    // Fetch VendorWallet by vendorId
    const wallet = await VendorWallet.findOne({ vendorId: new mongoose.Types.ObjectId(vendorId) }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Vendor wallet not found',
      });
    }

    // Check if holdBalance is sufficient
    if (wallet.holdBalance < withdrawal.amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient hold balance. Hold balance: ${wallet.holdBalance.toFixed(2)}, Requested: ${withdrawal.amount.toFixed(2)}`,
      });
    }

    // Simulate bank transfer success (manual or external system)
    // In production, this would integrate with payment gateway or bank API

    // Update wallet: holdBalance -= withdrawal.amount
    wallet.holdBalance = Math.round((wallet.holdBalance - withdrawal.amount) * 100) / 100;

    // Push wallet transaction
    wallet.transactions.push({
      type: 'DEBIT',
      amount: withdrawal.amount,
      referenceId: withdrawal._id,
      description: `Vendor payout completed - Payment Reference: ${paymentReference.trim()}`,
    });

    await wallet.save({ session });

    // Update withdrawal:
    // - status = "PAID"
    // - paidAt = current date
    // - paymentReference = provided reference
    withdrawal.status = 'PAID';
    withdrawal.paidAt = new Date();
    withdrawal.paymentReference = paymentReference.trim();
    withdrawal.approvedBy = new mongoose.Types.ObjectId(user.id);
    withdrawal.approvedAt = new Date();

    await withdrawal.save({ session });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Settlement completed successfully',
      data: {
        vendorId: vendorId,
        withdrawalRequestId: withdrawal._id,
        amountPaid: withdrawal.amount,
        paymentReference: paymentReference.trim(),
        paidAt: withdrawal.paidAt,
        walletBalance: wallet.balance,
        remainingHoldBalance: wallet.holdBalance,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in processSettlement:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to process settlement',
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  processSettlement,
};

