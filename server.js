/* =========================================================
   PEPEVOLT SERVER
========================================================= */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { ethers } = require("ethers");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================================================
   ENV
========================================================= */

const PORT =
    process.env.PORT || 3000;

const RPC_URL =
    process.env.RPC_URL;

const PRIVATE_KEY =
    process.env.PRIVATE_KEY;

const PVLT_ADDRESS =
    process.env.PVLT_ADDRESS;

const TREASURY_ADDRESS =
    process.env.TREASURY_ADDRESS;

const GAME_ADDRESS =
    process.env.GAME_ADDRESS;

/* =========================================================
   PROVIDER
========================================================= */

const provider =
    new ethers.providers.JsonRpcProvider(
        RPC_URL
    );

const wallet =
    new ethers.Wallet(
        PRIVATE_KEY,
        provider
    );

/* =========================================================
   ABI
========================================================= */

const GAME_ABI = [

    "function getPlayer(address user) view returns(uint256,uint256,uint256,bool,uint256)",

    "function refillEnergy() external",

    "function tap() external",

    "function buyEnergy() external",

    "function convertPoints() external",

    "function claimRewards() external"
];

const TREASURY_ABI = [

    "function treasuryBalance() view returns(uint256)",

    "function totalRevenue() view returns(uint256)",

    "function totalRewardsPaid() view returns(uint256)",

    "function totalBurnedGPVLT() view returns(uint256)",

    "function ownerWithdraw(uint256 amount) external",

    "function emergencyWithdrawAll() external"
];

const PVLT_ABI = [

    "function balanceOf(address user) view returns(uint256)"
];

/* =========================================================
   CONTRACTS
========================================================= */

const gameContract =
    new ethers.Contract(
        GAME_ADDRESS,
        GAME_ABI,
        wallet
    );

const treasuryContract =
    new ethers.Contract(
        TREASURY_ADDRESS,
        TREASURY_ABI,
        wallet
    );

const pvltContract =
    new ethers.Contract(
        PVLT_ADDRESS,
        PVLT_ABI,
        wallet
    );

/* =========================================================
   HOME
========================================================= */

app.get("/", async (req,res) => {

    res.json({

        success:true,

        project:"PEPEVOLT",

        network:"Polygon",

        status:"ONLINE"
    });
});

/* =========================================================
   PLAYER DATA
========================================================= */

app.get("/player/:address",
async (req,res) => {

    try{

        const address =
            req.params.address;

        const data =
            await gameContract.getPlayer(
                address
            );

        res.json({

            success:true,

            energy:
                Number(data[0]),

            points:
                Number(data[1]),

            burnedGPVLT:
                Number(data[2]),

            paidUser:
                data[3],

            lastClaimDay:
                Number(data[4])
        });

    } catch(err){

        res.status(500).json({

            success:false,

            error:err.message
        });
    }
});

/* =========================================================
   TREASURY INFO
========================================================= */

app.get("/treasury",
async (req,res) => {

    try{

        const balance =
            await treasuryContract
            .treasuryBalance();

        const revenue =
            await treasuryContract
            .totalRevenue();

        const rewards =
            await treasuryContract
            .totalRewardsPaid();

        const burned =
            await treasuryContract
            .totalBurnedGPVLT();

        res.json({

            success:true,

            treasuryBalance:
                ethers.utils.formatEther(
                    balance
                ),

            totalRevenue:
                ethers.utils.formatEther(
                    revenue
                ),

            totalRewardsPaid:
                ethers.utils.formatEther(
                    rewards
                ),

            totalBurnedGPVLT:
                burned.toString()
        });

    } catch(err){

        res.status(500).json({

            success:false,

            error:err.message
        });
    }
});

/* =========================================================
   PVLT BALANCE
========================================================= */

app.get("/pvlt/:address",
async (req,res) => {

    try{

        const address =
            req.params.address;

        const balance =
            await pvltContract.balanceOf(
                address
            );

        res.json({

            success:true,

            balance:
                ethers.utils.formatEther(
                    balance
                )
        });

    } catch(err){

        res.status(500).json({

            success:false,

            error:err.message
        });
    }
});

/* =========================================================
   OWNER WITHDRAW
========================================================= */

app.post("/owner/withdraw",
async (req,res) => {

    try{

        const amount =
            req.body.amount;

        const wei =
            ethers.utils.parseEther(
                amount
            );

        const tx =
            await treasuryContract
            .ownerWithdraw(wei);

        await tx.wait();

        res.json({

            success:true,

            hash:tx.hash,

            message:
                "Treasury withdrawal successful"
        });

    } catch(err){

        res.status(500).json({

            success:false,

            error:err.message
        });
    }
});

/* =========================================================
   EMERGENCY WITHDRAW ALL
========================================================= */

app.post("/owner/emergency-withdraw",
async (req,res) => {

    try{

        const tx =
            await treasuryContract
            .emergencyWithdrawAll();

        await tx.wait();

        res.json({

            success:true,

            hash:tx.hash,

            message:
                "Emergency withdrawal completed"
        });

    } catch(err){

        res.status(500).json({

            success:false,

            error:err.message
        });
    }
});

/* =========================================================
   SERVER
========================================================= */

app.listen(PORT, () => {

    console.log(
        `PEPEVOLT SERVER RUNNING ON PORT ${PORT}`
    );
});