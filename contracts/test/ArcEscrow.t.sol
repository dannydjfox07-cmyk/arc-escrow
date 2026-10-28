// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcEscrow} from "../ArcEscrow.sol";
import {MockERC20, BrokenERC20} from "../test-helpers/MockERC20.sol";

contract ArcEscrowTest is Test {
    // ─── contract instances ───────────────────────────────────────────────
    ArcEscrow internal escrow;
    MockERC20  internal usdc;

    // ─── actors ──────────────────────────────────────────────────────────
    address internal buyer  = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal third  = makeAddr("third");

    // ─── constants ────────────────────────────────────────────────────────
    uint256 internal constant AMOUNT = 100e6; // 100 USDC (6 dec)

    // ─── setUp ────────────────────────────────────────────────────────────
    function setUp() public {
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        escrow = new ArcEscrow(address(usdc));

        // fund buyer and approve escrow contract
        usdc.mint(buyer, 10_000e6);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Helper: create a fresh pending escrow as buyer
    // ══════════════════════════════════════════════════════════════════════
    function _create() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow(seller, AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T01 — createEscrow: struct, balance pull, event
    // ══════════════════════════════════════════════════════════════════════
    function test_T01_CreateEscrow_HappyPath() public {
        uint256 buyerBefore   = usdc.balanceOf(buyer);
        uint256 contractBefore = usdc.balanceOf(address(escrow));

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.EscrowCreated(1, buyer, seller, AMOUNT);

        vm.prank(buyer);
        uint256 id = escrow.createEscrow(seller, AMOUNT);

        assertEq(id, 1, "escrowId should be 1");
        assertEq(escrow.escrowCount(), 1, "escrowCount should be 1");

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.buyer,  buyer,                        "buyer stored");
        assertEq(e.seller, seller,                       "seller stored");
        assertEq(e.amount, AMOUNT,                       "amount stored");
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Pending), "state Pending");

        assertEq(usdc.balanceOf(buyer),           buyerBefore   - AMOUNT, "buyer balance decreased");
        assertEq(usdc.balanceOf(address(escrow)), contractBefore + AMOUNT, "contract balance increased");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T02 — releaseEscrow: USDC to seller, state Released, event
    // ══════════════════════════════════════════════════════════════════════
    function test_T02_ReleaseEscrow_HappyPath() public {
        uint256 id = _create();

        uint256 sellerBefore   = usdc.balanceOf(seller);
        uint256 contractBefore = usdc.balanceOf(address(escrow));

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.EscrowReleased(id, buyer, seller, AMOUNT);

        vm.prank(buyer);
        escrow.releaseEscrow(id);

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Released), "state Released");

        assertEq(usdc.balanceOf(seller),          sellerBefore   + AMOUNT, "seller received funds");
        assertEq(usdc.balanceOf(address(escrow)), contractBefore - AMOUNT, "contract balance decreased");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T03 — cancelEscrow: USDC returned to buyer, state Cancelled, event
    // ══════════════════════════════════════════════════════════════════════
    function test_T03_CancelEscrow_HappyPath() public {
        uint256 id = _create();

        uint256 buyerBefore    = usdc.balanceOf(buyer);
        uint256 contractBefore = usdc.balanceOf(address(escrow));

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.EscrowCancelled(id, buyer, seller, AMOUNT);

        vm.prank(buyer);
        escrow.cancelEscrow(id);

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Cancelled), "state Cancelled");

        assertEq(usdc.balanceOf(buyer),           buyerBefore    + AMOUNT, "buyer refunded");
        assertEq(usdc.balanceOf(address(escrow)), contractBefore - AMOUNT, "contract balance decreased");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T04 — updateSeller: changes seller, emits SellerUpdated
    // ══════════════════════════════════════════════════════════════════════
    function test_T04_UpdateSeller_HappyPath() public {
        uint256 id = _create();
        address newSeller = makeAddr("newSeller");

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.SellerUpdated(id, buyer, newSeller);

        vm.prank(buyer);
        escrow.updateSeller(id, newSeller);

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.seller, newSeller, "seller updated");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T05 — getEscrow: returns correct struct
    // ══════════════════════════════════════════════════════════════════════
    function test_T05_GetEscrow_ReturnsCorrectStruct() public {
        uint256 id = _create();
        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.buyer,  buyer,  "buyer");
        assertEq(e.seller, seller, "seller");
        assertEq(e.amount, AMOUNT, "amount");
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Pending), "state");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T06 — releaseEscrow by seller reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T06_Release_BySeller_Unauthorized() public {
        uint256 id = _create();
        vm.prank(seller);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.releaseEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T07 — releaseEscrow by third party reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T07_Release_ByThird_Unauthorized() public {
        uint256 id = _create();
        vm.prank(third);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.releaseEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T08 — cancelEscrow by seller reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T08_Cancel_BySeller_Unauthorized() public {
        uint256 id = _create();
        vm.prank(seller);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.cancelEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T09 — cancelEscrow by third party reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T09_Cancel_ByThird_Unauthorized() public {
        uint256 id = _create();
        vm.prank(third);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.cancelEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T10 — updateSeller by seller reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T10_UpdateSeller_BySeller_Unauthorized() public {
        uint256 id = _create();
        address newSeller = makeAddr("newSeller");
        vm.prank(seller);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.updateSeller(id, newSeller);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T11 — updateSeller by third party reverts Unauthorized
    // ══════════════════════════════════════════════════════════════════════
    function test_T11_UpdateSeller_ByThird_Unauthorized() public {
        uint256 id = _create();
        address newSeller = makeAddr("newSeller");
        vm.prank(third);
        vm.expectRevert(ArcEscrow.Unauthorized.selector);
        escrow.updateSeller(id, newSeller);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T12 — duplicate release reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T12_DuplicateRelease_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.releaseEscrow(id);

        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.releaseEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T13 — release a Cancelled escrow reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T13_Release_AfterCancel_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.cancelEscrow(id);

        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.releaseEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T14 — duplicate cancel reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T14_DuplicateCancel_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.cancelEscrow(id);

        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.cancelEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T15 — cancel a Released escrow reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T15_Cancel_AfterRelease_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.releaseEscrow(id);

        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.cancelEscrow(id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T16 — updateSeller on Released escrow reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T16_UpdateSeller_AfterRelease_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.releaseEscrow(id);

        address newSeller = makeAddr("newSeller");
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.updateSeller(id, newSeller);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T17 — updateSeller on Cancelled escrow reverts InvalidState
    // ══════════════════════════════════════════════════════════════════════
    function test_T17_UpdateSeller_AfterCancel_InvalidState() public {
        uint256 id = _create();
        vm.prank(buyer);
        escrow.cancelEscrow(id);

        address newSeller = makeAddr("newSeller");
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidState.selector);
        escrow.updateSeller(id, newSeller);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T18 — createEscrow with zero amount reverts ZeroAmount
    // ══════════════════════════════════════════════════════════════════════
    function test_T18_Create_ZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.ZeroAmount.selector);
        escrow.createEscrow(seller, 0);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T19 — createEscrow with seller = address(0) reverts ZeroAddress
    // ══════════════════════════════════════════════════════════════════════
    function test_T19_Create_ZeroAddressSeller() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.ZeroAddress.selector);
        escrow.createEscrow(address(0), AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T20 — createEscrow with seller = msg.sender reverts InvalidSeller
    // ══════════════════════════════════════════════════════════════════════
    function test_T20_Create_SellerEqualsBuyer() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidSeller.selector);
        escrow.createEscrow(buyer, AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T21 — createEscrow with seller in precompile range reverts InvalidSeller
    // ══════════════════════════════════════════════════════════════════════
    function test_T21_Create_PrecompileRangeSeller() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidSeller.selector);
        escrow.createEscrow(address(1), AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T22 — updateSeller with address(0) reverts ZeroAddress
    // ══════════════════════════════════════════════════════════════════════
    function test_T22_UpdateSeller_ZeroAddress() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.ZeroAddress.selector);
        escrow.updateSeller(id, address(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // T23 — updateSeller with buyer address reverts InvalidSeller
    // ══════════════════════════════════════════════════════════════════════
    function test_T23_UpdateSeller_NewSellerEqualsBuyer() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidSeller.selector);
        escrow.updateSeller(id, buyer);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T24 — updateSeller with precompile address reverts InvalidSeller
    // ══════════════════════════════════════════════════════════════════════
    function test_T24_UpdateSeller_PrecompileAddress() public {
        uint256 id = _create();
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.InvalidSeller.selector);
        escrow.updateSeller(id, address(0xFF));
    }

    // ══════════════════════════════════════════════════════════════════════
    // T25 — releaseEscrow on nonexistent ID reverts NotFound
    // ══════════════════════════════════════════════════════════════════════
    function test_T25_Release_NotFound() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.NotFound.selector);
        escrow.releaseEscrow(999);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T26 — cancelEscrow on nonexistent ID reverts NotFound
    // ══════════════════════════════════════════════════════════════════════
    function test_T26_Cancel_NotFound() public {
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.NotFound.selector);
        escrow.cancelEscrow(999);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T27 — updateSeller on nonexistent ID reverts NotFound
    // ══════════════════════════════════════════════════════════════════════
    function test_T27_UpdateSeller_NotFound() public {
        address newSeller = makeAddr("newSeller");
        vm.prank(buyer);
        vm.expectRevert(ArcEscrow.NotFound.selector);
        escrow.updateSeller(999, newSeller);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T28 — createEscrow with insufficient allowance reverts
    // ══════════════════════════════════════════════════════════════════════
    function test_T28_Create_InsufficientAllowance() public {
        address poorBuyer = makeAddr("poorBuyer");
        usdc.mint(poorBuyer, AMOUNT);
        // poorBuyer never calls approve → allowance is 0
        vm.prank(poorBuyer);
        vm.expectRevert();
        escrow.createEscrow(seller, AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T29 — createEscrow with insufficient balance reverts
    // ══════════════════════════════════════════════════════════════════════
    function test_T29_Create_InsufficientBalance() public {
        address brokeBuyer = makeAddr("brokeBuyer");
        // brokeBuyer has no tokens, but max allowance
        vm.prank(brokeBuyer);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(brokeBuyer);
        vm.expectRevert();
        escrow.createEscrow(seller, AMOUNT);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T30 — releaseEscrow when token transfer returns false reverts
    // ══════════════════════════════════════════════════════════════════════
    function test_T30_Release_TransferReturnsFalse() public {
        // Deploy a broken token and a separate escrow that uses it
        BrokenERC20 broken = new BrokenERC20();
        ArcEscrow brokenEscrow = new ArcEscrow(address(broken));

        // Seed buyer balance and approve
        broken.mint(buyer, AMOUNT);
        vm.prank(buyer);
        broken.approve(address(brokenEscrow), type(uint256).max);

        // createEscrow will also fail because transferFrom returns false.
        // We need to get a Pending escrow into the contract manually.
        // Since the BrokenERC20 always returns false on transferFrom too,
        // we cannot use createEscrow. Instead, we bypass via vm.store:
        // write directly to the escrows mapping slot so the escrow exists
        // without needing a real transfer in.
        //
        // escrows mapping is at storage slot 0 (first declared var).
        // Solidity mapping key slot = keccak256(abi.encode(key, slot)).
        uint256 escrowId = 1;
        bytes32 baseSlot = keccak256(abi.encode(escrowId, uint256(0)));

        // Escrow struct layout (packed): buyer (addr, slot+0 lower 160), 
        // seller (addr, slot+1 lower 160), amount (slot+2), state (slot+3 low 8)
        // buyer at baseSlot
        vm.store(address(brokenEscrow), baseSlot,           bytes32(uint256(uint160(buyer))));
        // seller at baseSlot+1
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 1), bytes32(uint256(uint160(seller))));
        // amount at baseSlot+2
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 2), bytes32(AMOUNT));
        // state = Pending (0) at baseSlot+3
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 3), bytes32(uint256(0)));
        // escrowCount at slot 1
        vm.store(address(brokenEscrow), bytes32(uint256(1)), bytes32(uint256(1)));

        // Give the broken escrow contract a balance so the transfer isn't blocked by zero-balance
        broken.mint(address(brokenEscrow), AMOUNT);

        // Now release should fail because safeTransfer gets false back
        vm.prank(buyer);
        vm.expectRevert();
        brokenEscrow.releaseEscrow(escrowId);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T31 — cancelEscrow when token transfer returns false reverts
    // ══════════════════════════════════════════════════════════════════════
    function test_T31_Cancel_TransferReturnsFalse() public {
        BrokenERC20 broken = new BrokenERC20();
        ArcEscrow brokenEscrow = new ArcEscrow(address(broken));

        uint256 escrowId = 1;
        bytes32 baseSlot = keccak256(abi.encode(escrowId, uint256(0)));

        vm.store(address(brokenEscrow), baseSlot,                            bytes32(uint256(uint160(buyer))));
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 1),      bytes32(uint256(uint160(seller))));
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 2),      bytes32(AMOUNT));
        vm.store(address(brokenEscrow), bytes32(uint256(baseSlot) + 3),      bytes32(uint256(0)));
        vm.store(address(brokenEscrow), bytes32(uint256(1)),                  bytes32(uint256(1)));

        broken.mint(address(brokenEscrow), AMOUNT);

        vm.prank(buyer);
        vm.expectRevert();
        brokenEscrow.cancelEscrow(escrowId);
    }

    // ══════════════════════════════════════════════════════════════════════
    // T32 — Fuzz: createEscrow with valid amount and seller
    // ══════════════════════════════════════════════════════════════════════
    function testFuzz_T32_CreateEscrow(uint256 amount, address fuzzSeller) public {
        // Bound amount to non-zero and within buyer's balance cap
        amount = bound(amount, 1, 1_000_000e6);

        // Ensure fuzzSeller is a valid seller:
        // not zero, not buyer, not precompile (uint160 <= 0xFF)
        vm.assume(fuzzSeller != address(0));
        vm.assume(fuzzSeller != buyer);
        vm.assume(uint160(fuzzSeller) > 0xFF);

        // Mint enough for buyer
        usdc.mint(buyer, amount);

        uint256 buyerBefore    = usdc.balanceOf(buyer);
        uint256 contractBefore = usdc.balanceOf(address(escrow));
        uint256 countBefore    = escrow.escrowCount();

        vm.prank(buyer);
        uint256 id = escrow.createEscrow(fuzzSeller, amount);

        assertEq(id, countBefore + 1,            "escrowId increments");
        assertEq(escrow.escrowCount(), countBefore + 1, "escrowCount increments");

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.buyer,  buyer,       "buyer stored");
        assertEq(e.seller, fuzzSeller,  "seller stored");
        assertEq(e.amount, amount,      "amount stored");
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Pending), "state Pending");

        assertEq(usdc.balanceOf(buyer),           buyerBefore    - amount, "buyer balance decreased");
        assertEq(usdc.balanceOf(address(escrow)), contractBefore + amount, "contract balance increased");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Extra: escrowCount increments correctly across multiple creates
    // ══════════════════════════════════════════════════════════════════════
    function test_EscrowCount_SequentialIds() public {
        address seller2 = makeAddr("seller2");
        address seller3 = makeAddr("seller3");

        vm.startPrank(buyer);
        uint256 id1 = escrow.createEscrow(seller,  AMOUNT);
        uint256 id2 = escrow.createEscrow(seller2, AMOUNT);
        uint256 id3 = escrow.createEscrow(seller3, AMOUNT);
        vm.stopPrank();

        assertEq(id1, 1, "first id");
        assertEq(id2, 2, "second id");
        assertEq(id3, 3, "third id");
        assertEq(escrow.escrowCount(), 3, "escrowCount == 3");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T33 — constructor reverts ZeroAddress when usdc_ == address(0)
    // ══════════════════════════════════════════════════════════════════════
    function test_T33_Constructor_ZeroAddress() public {
        vm.expectRevert(ArcEscrow.ZeroAddress.selector);
        new ArcEscrow(address(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // T34 — updateSeller then release sends funds to the updated seller
    // ══════════════════════════════════════════════════════════════════════
    function test_T34_UpdateSeller_ThenRelease_FundsGoToNewSeller() public {
        uint256 id = _create();

        address newSeller = makeAddr("newSeller");

        // Buyer redirects the seller
        vm.prank(buyer);
        escrow.updateSeller(id, newSeller);

        uint256 newSellerBefore  = usdc.balanceOf(newSeller);
        uint256 oldSellerBefore  = usdc.balanceOf(seller);
        uint256 contractBefore   = usdc.balanceOf(address(escrow));

        // Buyer releases — funds must go to newSeller, not original seller
        vm.prank(buyer);
        escrow.releaseEscrow(id);

        assertEq(usdc.balanceOf(newSeller),         newSellerBefore  + AMOUNT, "newSeller received funds");
        assertEq(usdc.balanceOf(seller),             oldSellerBefore,            "original seller untouched");
        assertEq(usdc.balanceOf(address(escrow)),   contractBefore   - AMOUNT, "contract balance decreased");

        ArcEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint8(e.state), uint8(ArcEscrow.EscrowState.Released), "state Released");
        assertEq(e.seller, newSeller, "stored seller is newSeller");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T35 — operating on one escrow does not affect a concurrent escrow
    // ══════════════════════════════════════════════════════════════════════
    function test_T35_MultipleEscrows_Isolation() public {
        address buyer2  = makeAddr("buyer2");
        address seller2 = makeAddr("seller2");

        // Fund and approve a second buyer
        usdc.mint(buyer2, 10_000e6);
        vm.prank(buyer2);
        usdc.approve(address(escrow), type(uint256).max);

        // Create two independent escrows
        vm.prank(buyer);
        uint256 id1 = escrow.createEscrow(seller, AMOUNT);

        vm.prank(buyer2);
        uint256 id2 = escrow.createEscrow(seller2, AMOUNT);

        uint256 seller2Before   = usdc.balanceOf(seller2);
        uint256 contractBefore  = usdc.balanceOf(address(escrow));

        // Release escrow #2 only
        vm.prank(buyer2);
        escrow.releaseEscrow(id2);

        // Escrow #1 must remain Pending and untouched
        ArcEscrow.Escrow memory e1 = escrow.getEscrow(id1);
        assertEq(uint8(e1.state), uint8(ArcEscrow.EscrowState.Pending), "escrow #1 still Pending");
        assertEq(e1.buyer,  buyer,  "escrow #1 buyer unchanged");
        assertEq(e1.seller, seller, "escrow #1 seller unchanged");
        assertEq(e1.amount, AMOUNT, "escrow #1 amount unchanged");

        // Escrow #2 must be Released
        ArcEscrow.Escrow memory e2 = escrow.getEscrow(id2);
        assertEq(uint8(e2.state), uint8(ArcEscrow.EscrowState.Released), "escrow #2 Released");

        // Balances: only AMOUNT left in contract (escrow #1), seller2 received AMOUNT
        assertEq(usdc.balanceOf(address(escrow)), contractBefore - AMOUNT, "contract holds only escrow #1");
        assertEq(usdc.balanceOf(seller2),          seller2Before  + AMOUNT, "seller2 paid");

        // Cancel escrow #1 — must still work normally
        vm.prank(buyer);
        escrow.cancelEscrow(id1);

        ArcEscrow.Escrow memory e1after = escrow.getEscrow(id1);
        assertEq(uint8(e1after.state), uint8(ArcEscrow.EscrowState.Cancelled), "escrow #1 Cancelled");
        assertEq(usdc.balanceOf(address(escrow)), 0, "contract emptied");
    }

    // ══════════════════════════════════════════════════════════════════════
    // T36 — EscrowReleased and EscrowCancelled events carry correct params
    // ══════════════════════════════════════════════════════════════════════
    function test_T36_EventParameters_ReleaseAndCancel() public {
        // --- Release event ---
        uint256 idR = _create();

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.EscrowReleased(idR, buyer, seller, AMOUNT);

        vm.prank(buyer);
        escrow.releaseEscrow(idR);

        // --- Cancel event ---
        uint256 idC = _create(); // creates escrow #2

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcEscrow.EscrowCancelled(idC, buyer, seller, AMOUNT);

        vm.prank(buyer);
        escrow.cancelEscrow(idC);
    }
}
