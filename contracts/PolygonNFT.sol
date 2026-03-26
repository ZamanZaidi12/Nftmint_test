// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PolygonNFT
 * @dev ERC-721 NFT contract with configurable mint price and supply cap
 * Deployed on Polygon Mumbai testnet
 */
contract PolygonNFT is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 5;
    uint256 public mintPrice;
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    event NFTMinted(address indexed to, uint256 indexed tokenId, uint256 price);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event BaseURIUpdated(string newBaseURI);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // ─── Errors

    error MaxSupplyReached();
    error InsufficientPayment(uint256 required, uint256 sent);
    error WithdrawFailed();
    error ZeroAddress();
    error ZeroPrice();

    /**
     * @param initialOwner  Address that will own the contract
     * @param initialPrice  Mint price in wei (pass 1e18 for 1 MATIC)
     * @param baseURI       IPFS / HTTP base URI ending in "/"
     */
    constructor(
        address initialOwner,
        uint256 initialPrice,
        string memory baseURI
    ) ERC721("PolygonNFT", "PNFT")  {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialPrice == 0) revert ZeroPrice();

        mintPrice = initialPrice;
        _baseTokenURI = baseURI;
        _nextTokenId = 1; // token IDs start at 1
    }

    
    function mint(address to) external payable nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (_nextTokenId > MAX_SUPPLY) revert MaxSupplyReached();
        if (msg.value < mintPrice) revert InsufficientPayment(mintPrice, msg.value);

        uint256 tokenId = _nextTokenId;
        unchecked {
            _nextTokenId++;
        }

        _safeMint(to, tokenId);

        // Refund any excess payment
        if (msg.value > mintPrice) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(refunded, "Refund failed");
        }

        emit NFTMinted(to, tokenId, mintPrice);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        uint256 old = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(old, newPrice);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();

        emit FundsWithdrawn(owner(), balance);
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function remainingSupply() external view returns (uint256) {
        uint256 minted = _nextTokenId - 1;
        return minted >= MAX_SUPPLY ? 0 : MAX_SUPPLY - minted;
    }

    // Internal Overrides

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }
}
