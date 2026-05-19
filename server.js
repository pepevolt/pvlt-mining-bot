/* ================= CLAIM PVLTG ================= */
app.post("/claim-pvltg", async (req, res) => {
    try {
        const { wallet: userWallet } = req.body;
        if (!userWallet) return res.json({ error: "Wallet required" });

        const addressKey = userWallet.toLowerCase();
        const user = users[addressKey];

        if (!user) { return res.json({ error: "User not found" }); }
        
        if (user.pvltg < 10) { return res.json({ error: "Need minimum 10 PVLTG" }); }

        const pvltAmountToPayout = user.pvltg / 10; 
        const amountInWei = ethers.utils.parseEther(pvltAmountToPayout.toString());

        console.log(`Processing payout for ${addressKey}. Swapping ${user.pvltg} PVLTG for ${pvltAmountToPayout} PVLT`);

        // EXECUTE THE SWAP ON YOUR SMART CONTRACT - This creates the 'tx' variable!
        let tx;
        try {
            tx = await gameEngine.swapPVLTGtoPVLT(addressKey, amountInWei);
        } catch(e) {
            tx = await gameEngine.swapPVLTGtoPVLT(amountInWei);
        }
        await tx.wait();

        // Clear user database balance after successful blockchain transaction confirmation
        user.pvltg = 0;
        res.json({ success: true, tx: tx.hash });

    } catch (err) {
        console.error("CRITICAL ERROR DURING CLAIM ATTEMPT:", err);
        res.json({ error: "Claim processing failed on-chain: " + (err.reason || err.message) });
    }
});
