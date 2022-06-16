// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 < 0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MusicNFTMarketplace is ERC721("BoogieFi","BooFi"), Ownable {
    // State variables
    string public baseURI = "https://bafybeihyqawpffafu4db7yyekya6q5lisotgoqh6g27xegvy5vvzowwswm.ipfs.nftstorage.link/";
    string public baseExtension = ".json";  
    address public artist;  // address of the artist that deploys music NFTs
    uint256 public royaltyFee;  // roylty fee that artist gets when his NFTs gets sold

    struct MarketItem {
        uint256 tokenId;
        address payable seller;
        uint256  price;
    }

    MarketItem[] public marketItems; // its an array tha contains  MarketItem struct data


    // event
    event MarketItemBought( uint256 indexed tokenId, address indexed seller, address buyer, uint256  price );
    event MarketItemRelisted( uint256 indexed tokenId, address indexed seller,  uint256  price );

    // In constructor we initialise the royalty fww, artist address and prices ofthe music NFTs
    constructor (
        uint256 _royaltFee,
        address _artist,
        uint256[] memory _prices // arryy of prices of music NFTs
    ) payable {
        require(
            _prices.length*_royaltFee <= msg.value,
            "Deployer must pay royalty fee for each token/NFT listed on the marketplace"
        );
        royaltyFee = _royaltFee;
        artist = _artist;
        for(uint8 i = 0; i< _prices.length; i++){
            require(_prices[i] >0, "Price must be greater that 0");
            _mint(address(this), i);  // assigning all the NFTs to contract address with tokenId 
            marketItems.push(MarketItem(i,payable(msg.sender),_prices[i]));  // adding all the NFTs to the array marketitems(tokenId, Seller address, price of NFT)
        }
    }
   
    // Function that only allow deployer to update royalty fee
    function updateRoyaltyFee(uint256 _royaltyFee) external onlyOwner {  //onlyOwner checks is the deployer is calling the function or not
        royaltyFee = _royaltyFee;
    }

    //Function to create sales for music-nfts
    // also Transfer ownership of the nfts as well as funcds between parties
    function buyToken(uint256 _tokenId) external payable {
        uint256 price = marketItems[_tokenId].price;
        address seller = marketItems[_tokenId].seller;
        require(
            msg.value == price,
            "Please send asking price in order to complete the Purchase"
        );
        marketItems[_tokenId].seller = payable(address(0)); // setting nft seller addres as invalid or zero addres as nft is sold
        _transfer(address(this),msg.sender, _tokenId);   //transfer the NFT to address that is calling the function from the
        payable(artist).transfer(royaltyFee);  // transfer royalty fee to the artist
        payable(seller).transfer(msg.value);   // transfer music-nft price to the seller
        emit MarketItemBought(_tokenId, seller, msg.sender, price);
    }

    // Allow someone to resell their NFTs
    function resellToken(uint256 _tokenId,uint256 _price) external payable{
        require(msg.value == royaltyFee, "Must pay royalt Fee");
        require(_price > 0, "Price must be greator than zero");
        marketItems[_tokenId].price = _price;
        marketItems[_tokenId].seller = payable(msg.sender);

        _transfer(msg.sender, address(this), _tokenId);
        emit MarketItemRelisted(_tokenId,msg.sender, _price);
    }

    //Fetch data or marketItems from smart contract
    function getAllUnsoldTokens() external view returns (MarketItem[] memory) {
        uint256 unsoldCount = balanceOf(address(this));   //All those NFTs that are allocated to this address are unsold, we are retrieveing those
        MarketItem[] memory tokens = new MarketItem[](unsoldCount);  // creating new in-memory marketitems array of name "tokens" with fixd length
        uint256 currentIndex;
        for(uint256 i = 0; i < marketItems.length; i++) {
            if(marketItems[i].seller != address(0)){
                tokens[currentIndex] = marketItems[i];
                currentIndex ++;
            }
           }
           return (tokens);
    }

    //Fetch all tokens owned by user
    function getMyTokens() external view returns (MarketItem[] memory){
        uint256 myTokenCount = balanceOf(msg.sender);   //All those NFTs that are allocated to user's address are those which user have
        MarketItem[] memory tokens = new MarketItem[](myTokenCount);  // creating new in-memory marketitems array of name "tokens" with fixd length
        uint256 currentIndex;
        for(uint256 i = 0; i < marketItems.length; i++) {
            if(ownerOf(i) == msg.sender){
                tokens[currentIndex] = marketItems[i];
                currentIndex ++;
            }
           }
           return (tokens);
    }

    //Internal function to gets the BaseURi initialized in the constructor
    function _baseURI() internal view virtual override returns (string memory){
        return baseURI;
    }
}
