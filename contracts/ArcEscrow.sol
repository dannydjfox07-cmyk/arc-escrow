// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ArcEscrow
/// @notice Non-custodial USDC escrow for Arc EVM chain buyers and sellers.
/// @dev The buyer may cancel any pending escrow at any time and recover all deposited USDC.
///      This contract provides no dispute resolution, arbitration, or guaranteed seller protection.
///      USDC blacklist/permissions may prevent transfers to or from certain addresses; if USDC blocks a transfer,
///      release/cancel operations can revert until token-level restrictions are resolved.
///      If a pending escrow seller becomes unreachable, the buyer can call updateSeller to set a new seller.
contract ArcEscrow {
    using SafeERC20 for IERC20;

    enum EscrowState {
        Pending,
        Released,
        Cancelled
    }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        EscrowState state;
    }

    error ZeroAmount();
    error ZeroAddress();
    error InvalidSeller();
    error Unauthorized();
    error InvalidState();
    error NotFound();

    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowCancelled(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount);
    event SellerUpdated(uint256 indexed escrowId, address indexed buyer, address indexed newSeller);

    mapping(uint256 => Escrow) public escrows;
    uint256 public escrowCount;

    address public immutable usdc;

    /// @param usdc_ The USDC ERC-20 token address used for all escrow deposits and payouts.
    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Creates a new escrow and pulls USDC from the buyer into this contract.
    /// @dev Checks are performed first, including a guard that rejects Arc precompile-range seller addresses,
    ///      then state is written (new id + escrow struct), then token transfer interaction.
    /// @param seller The seller address that will receive funds on release.
    /// @param amount The escrowed USDC amount (6-decimal token units).
    /// @return escrowId The newly created escrow id.
    function createEscrow(address seller, uint256 amount) external returns (uint256 escrowId) {
        if (amount == 0) revert ZeroAmount();
        if (seller == address(0)) revert ZeroAddress();
        if (seller == msg.sender) revert InvalidSeller();
        if (uint160(seller) <= 0xFF) revert InvalidSeller();

        escrowId = ++escrowCount;
        escrows[escrowId] = Escrow({buyer: msg.sender, seller: seller, amount: amount, state: EscrowState.Pending});

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowCreated(escrowId, msg.sender, seller, amount);
    }

    /// @notice Allows the buyer to update the seller address while the escrow is still Pending.
    /// @dev This provides a recovery path if the original seller address becomes unreachable
    ///      (e.g. a USDC blacklist event). Does not affect state or funds.
    /// @param escrowId The escrow to update.
    /// @param newSeller The new seller address.
    function updateSeller(uint256 escrowId, address newSeller) external {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.buyer == address(0)) revert NotFound();
        if (msg.sender != escrow.buyer) revert Unauthorized();
        if (escrow.state != EscrowState.Pending) revert InvalidState();
        if (newSeller == address(0)) revert ZeroAddress();
        if (newSeller == escrow.buyer) revert InvalidSeller();
        if (uint160(newSeller) <= 0xFF) revert InvalidSeller();
        escrow.seller = newSeller;
        emit SellerUpdated(escrowId, escrow.buyer, newSeller);
    }

    /// @notice Releases a pending escrow to the seller.
    /// @dev Checks escrow existence/authorization/state first, updates state to Released, then transfers USDC.
    /// @param escrowId The id of the escrow to release.
    function releaseEscrow(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];

        if (escrow.buyer == address(0)) revert NotFound();
        if (msg.sender != escrow.buyer) revert Unauthorized();
        if (escrow.state != EscrowState.Pending) revert InvalidState();

        escrow.state = EscrowState.Released;

        IERC20(usdc).safeTransfer(escrow.seller, escrow.amount);

        emit EscrowReleased(escrowId, escrow.buyer, escrow.seller, escrow.amount);
    }

    /// @notice Cancels a pending escrow and refunds the buyer.
    /// @dev Checks escrow existence/authorization/state first, updates state to Cancelled, then transfers USDC.
    /// @param escrowId The id of the escrow to cancel.
    function cancelEscrow(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];

        if (escrow.buyer == address(0)) revert NotFound();
        if (msg.sender != escrow.buyer) revert Unauthorized();
        if (escrow.state != EscrowState.Pending) revert InvalidState();

        escrow.state = EscrowState.Cancelled;

        IERC20(usdc).safeTransfer(escrow.buyer, escrow.amount);

        emit EscrowCancelled(escrowId, escrow.buyer, escrow.seller, escrow.amount);
    }

    /// @notice Returns escrow data for a given id.
    /// @param escrowId The escrow id to read.
    /// @return The escrow struct stored at the given id.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }
}
