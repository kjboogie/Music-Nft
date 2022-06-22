/* eslint-disable jest/valid-expect */



require("@nomiclabs/hardhat-waffle");
const { ethers,artifacts } = require("hardhat");
const { expect } = require("chai");

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe("MusicNFTMarketplace", function () {
    
    let nftMarketplace;
    let deployer, artist, user1, user2, users;
    let royaltyFee = toWei(0.01);  // 1 ether = 10^18 wei
    let URI = "https://bafybeihyqawpffafu4db7yyekya6q5lisotgoqh6g27xegvy5vvzowwswm.ipfs.nftstorage.link/";
    let prices = [toWei(1), toWei(2)];
    let deploymentFees = toWei(prices.length * 0.01);
    beforeEach(async function (){
        //Get the ContractFactory and Signers here.
        const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");
        [deployer,artist, user1, user2, ...users] = await ethers.getSigners(); // getting accounts on local blockchain by calling getSigners function and return array with all the developments accounts

        //Deploy Music-nft Marketplace smart contract
        nftMarketplace = await NFTMarketplaceFactory.deploy(
            royaltyFee,
            artist.address,
            prices,
            { value: deploymentFees }  // ether needed to cover royaltyFees
        );
    });

    describe("deployment", function () {

        it("Should track name, symbol, URI, royalty fee and artist", async function() {
            const nftName = "BoogieFi";
            const nftSymbol = "BooFi";
            expect(await nftMarketplace.name()).to.equal(nftName);
            expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
            expect(await nftMarketplace.baseURI()).to.equal(URI);
            expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
            expect(await nftMarketplace.artist)

        });

        it("Should min then list all the music NFTs", async function(){
            expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(2);
            // Get each item from the marketItems array then check fields to ensure they are correct
            await Promise.all(prices.map(async (i, indx) =>{   //promise.all ensure that all operations perform on all the items
                const item = await nftMarketplace.marketItems(indx)
                expect(item.tokenId).to.equal(indx)
                expect(item.seller).to.equal(deployer.address)
                expect(item.price).to.equal(i)
            }))
        });

        it("Ether balance should equal to the deployment fees", async function() {
            expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees)
        });

    });

    describe("Updating royalty fee", function () {
        it("Only deployer is allowed to update the royalty fee", async function () {
            const fee = toWei(0.02)  //setting fee
            await nftMarketplace.updateRoyaltyFee(fee) //updating royalty fee by calling updateRoyaltyFee function from smart contract : Be default it takes deployer acount
            await expect(
                nftMarketplace.connect(user1).updateRoyaltyFee(fee) // trying to call updateRoyaltyFee function with different account other than deployer
            ).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await nftMarketplace.royaltyFee()).to.equal(fee)
        });
    });

    describe("Buying Tokens", function () {
        it("Should update seller to zero address, Transfer NFT, pay seller, pay royaltyFee to artist and emits MerketitemBoungt event",async function (){
            const deployerInitialEthBal = await deployer.getBalance()
            const artistInitialEthBal = await artist.getBalance()
            //User 1 purchased item
            await expect(nftMarketplace.connect(user1).buyToken(0,{ value: prices[0]}))  // user1 is buying nft with index 0 and price of index 0
            .to.emit(nftMarketplace, "MarketItemBought")  // check MarketItemBought event is emitted with this argments
            .withArgs(
                0,                         //tokenId
                deployer.address,          //Seller
                user1.address,              //buyer
                prices[0]                    //price of NFT
            )
            const deployerFinalEthBal = await deployer.getBalance()
            const artistFinalEthBal =  await artist.getBalance()
            //Sold Nft should have seller address as 0
            expect((await nftMarketplace.marketItems(0)).seller).to.equal("0x0000000000000000000000000000000000000000")
            //Seller should recieve payment for the price of NFT sold
            
            expect(+fromWei(deployerFinalEthBal)).to.equal(+fromWei(prices[0]) + +fromWei(deployerInitialEthBal)) 
            // Artist should get royalt fee
            expect(+fromWei(artistFinalEthBal)).to.equal(+fromWei(royaltyFee) + +fromWei(artistInitialEthBal))
            //Buyer is now the owener of the NFT
            expect(await nftMarketplace.ownerOf(0)).to.equal(user1.address)

        })

        it("should fail when ether amount send with transcation to buy does ot equal to asking price", async function () {
            //Fails when ether send does not equal to the asking price
            await expect(
                nftMarketplace.connect(user1).buyToken(0,{ value: prices[1]})
            ).to.be.revertedWith("Please send asking price in order to complete the Purchase");
        });

    });

    describe('Reselling tokens/NFTs', function ()  { 
        beforeEach(async function () {
            // user 1 purchases an item.
            await nftMarketplace.connect(user1).buyToken(0, { value: prices[0]})
        })

        it("should track resale item, increase ether bal by royalt Fee, transfer NFT from marketplace and emit MarketItemRelisted event", async function () {
            const resaleprice = toWei(2)
            const initMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
            // user1 list the music-nft with price of 2 in hoping to flip the money
            await expect(nftMarketplace.connect(user1).resellToken(0, resaleprice, {value: royaltyFee}))
            .to.emit(nftMarketplace, "MarketItemRelisted")
            .withArgs(
                0,
                user1.address,
                resaleprice
            )
            const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
            //Expect final market bal to equal initia; + royaltyFee
            expect(+fromWei(finalMarketBal)).to.equal(+fromWei(royaltyFee) + +fromWei(initMarketBal))
        
            //Owner of the NFT , should now me marketplace
            expect(await nftMarketplace.ownerOf(0)).to.equal(nftMarketplace.address)
            //Get item from items mapping to esndure fields are correct
            const item = await nftMarketplace.marketItems(0)
            expect(item.tokenId).to.equal(0)
            expect(item.seller).to.equal(user1.address)
            expect(item.price).to.equal(resaleprice)
        });

        it("Sould fail if price is set to zero and royalt Fee is not paid", async function () {
            await expect(
                nftMarketplace.connect(user1).resellToken(0, 0, {value : royaltyFee})
            ).to.be.revertedWith("Price must be greator than zero");
            await expect(
                nftMarketplace.connect(user1).resellToken(0, toWei(1), {value: 0})
            ).to.be.revertedWith("Must pay royalt Fee");
        });

     });

     describe("Getter functions", function () {
        let soldItems = [0, 1 ]
        let ownedByUser1 = [0]
        let ownedByUser2 = [1]
        beforeEach(async function () {
          // user1 purchases item 0.
          await (await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })).wait();
          // user1 purchases item 1.
          await (await nftMarketplace.connect(user2).buyToken(1, { value: prices[1] })).wait();
      
        })
    
        it("getAllUnsoldTokens should fetch all the marketplace items up for sale", async function () {
          const unsoldItems = await nftMarketplace.getAllUnsoldTokens()
          // Check to make sure that all the returned unsoldItems have filtered out the sold items.
          expect(unsoldItems.every(i => !soldItems.some(j => j === i.tokenId.toNumber()))).to.equal(true)
          // Check that the length is correct
          expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true)
        });
        it("getMyTokens should fetch all tokens the user owns", async function () {
          // Get items owned by user1
          let myItems = await nftMarketplace.connect(user1).getMyTokens()
          // Check that the returned my items array is correct
         expect(myItems.every(i => ownedByUser1.some(j => j === i.tokenId.toNumber()))).to.equal(true)
         //expect(myItems[0].tokenId).to.equal(0)
          expect(ownedByUser1.length === myItems.length).to.equal(true)
          // Get items owned by user2

         
          let myItemss = await nftMarketplace.connect(user2).getMyTokens()
          // Check that the returned my items array is correct
          expect(myItemss.every(i => ownedByUser2.some(j => j === i.tokenId.toNumber()))).to.equal(true)
          expect(ownedByUser2.length === myItems.length).to.equal(true)
        
         //expect(myItemss[0].tokenId).to.equal("1")
      
       
        });
        
      });



})