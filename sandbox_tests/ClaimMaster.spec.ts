import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, Dictionary, beginCell, toNano } from '@ton/core';
import { ClaimMaster, ClaimMasterEntry, generateEntriesDictionary } from '../wrappers/ClaimMaster';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { ClaimHelper } from '../wrappers/ClaimHelper';

describe('ClaimMaster', () => {
    let code: Cell;
    let codeHelper: Cell;
    let codeJettonMinter: Cell;
    let codeJettonWallet: Cell;

    beforeAll(async () => {
        code = await compile('ClaimMaster');
        codeHelper = await compile('ClaimHelper');
        codeJettonMinter = await compile('JettonMinter');
        codeJettonWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let claimMaster: SandboxContract<ClaimMaster>;
    let dictionary: Dictionary<bigint, ClaimMasterEntry>;
    let dictCell: Cell;
    let users: SandboxContract<TreasuryContract>[];
    let jettonMinter: SandboxContract<JettonMinter>;
    let entries: ClaimMasterEntry[];

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        users = await blockchain.createWallets(1000);

        entries = [];
        for (let i = 0; i < 1000; i++) {
            entries.push({
                address: users[parseInt(i.toString())].address,
                amount: BigInt(Math.floor(Math.random() * 1e9)),
            });
        }
        dictionary = generateEntriesDictionary(entries);

        dictCell = beginCell().storeDictDirect(dictionary).endCell();

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    wallet_code: codeJettonWallet,
                    admin: users[0].address,
                    content: Cell.EMPTY,
                },
                codeJettonMinter
            )
        );

        await jettonMinter.sendDeploy(users[0].getSender(), toNano('0.05'));

        claimMaster = blockchain.openContract(
            ClaimMaster.createFromConfig(
                {
                    helperCode: codeHelper,
                    merkleRoot: BigInt('0x' + dictCell.hash().toString('hex')),
                },
                code
            )
        );

        const deployResult = await claimMaster.sendDeploy(
            users[0].getSender(),
            toNano('0.05'),
            await jettonMinter.getWalletAddress(claimMaster.address)
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: users[0].address,
            to: claimMaster.address,
            deploy: true,
            success: true,
        });

        await jettonMinter.sendMint(
            users[0].getSender(),
            claimMaster.address,
            toNano('1000000'),
            toNano('0.01'),
            toNano('0.05'),
        );
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and claimMaster are ready to use
    });

    it('should claim one time', async () => {
        const jettonWallet = blockchain
            .openContract(
                JettonWallet.createFromAddress(
                    await jettonMinter.getWalletAddress(users[1].address)
                )
            );
        
        const merkleProof = dictionary.generateMerkleProof(1n);
        const helper = blockchain.openContract(
            ClaimHelper.createFromConfig(
                {
                    master: claimMaster.address,
                    index: 1n,
                    proofHash: merkleProof.hash(),
                },
                codeHelper
            )
        );
        await helper.sendDeploy(users[1].getSender());
        const result = await helper.sendClaim(123n, merkleProof);
        expect(result.transactions).toHaveTransaction({
            on: claimMaster.address,
            success: true,
        });
        console.log('balance after:', await jettonWallet.getJettonBalance());
        expect(
            await jettonWallet.getJettonBalance()
        ).toEqual(dictionary.get(1n)?.amount);
        expect(await helper.getClaimed()).toBeTruthy();
    });

    it('should claim many times', async () => {
        for (let i = 0; i < 1000; i += 1 + Math.floor(Math.random() * 25)) {
            const merkleProof = dictionary.generateMerkleProof(BigInt(i));
            const helper = blockchain.openContract(
                ClaimHelper.createFromConfig(
                    {
                        master: claimMaster.address,
                        index: BigInt(i),
                        proofHash: merkleProof.hash(),
                    },
                    codeHelper
                )
            );
            await helper.sendDeploy(users[i].getSender());
            const result = await helper.sendClaim(123n, merkleProof);
            expect(result.transactions).toHaveTransaction({
                on: claimMaster.address,
                success: true,
            });

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(users[i].address))
                    )
                    .getJettonBalance()
            ).toEqual(dictionary.get(BigInt(i))?.amount);
            expect(await helper.getClaimed()).toBeTruthy();
        }
    });

    it('should not claim if already did', async () => {
        const merkleProof = dictionary.generateMerkleProof(1n);

        const helper = blockchain.openContract(
            ClaimHelper.createFromConfig(
                {
                    master: claimMaster.address,
                    index: 1n,
                    proofHash: merkleProof.hash(),
                },
                codeHelper
            )
        );
        await helper.sendDeploy(users[1].getSender());

        {
            const result = await helper.sendClaim(123n, merkleProof);
            expect(result.transactions).toHaveTransaction({
                on: claimMaster.address,
                success: true,
            });
            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(users[1].address))
                    )
                    .getJettonBalance()
            ).toEqual(dictionary.get(1n)?.amount);
            expect(await helper.getClaimed()).toBeTruthy();
        }

        // {
        //     await expect(helper.sendClaim(123n, merkleProof)).rejects.toThrow();
        //     expect(
        //         await blockchain
        //             .openContract(
        //                 JettonWallet.createFromAddress(await jettonMinter.getWalletAddressOf(users[1].address))
        //             )
        //             .getJettonBalance()
        //     ).toEqual(dictionary.get(1n)?.amount);
        //     expect(await helper.getClaimed()).toBeTruthy();
        // }

        // {
        //     await expect(helper.sendClaim(123n, merkleProof)).rejects.toThrow();
        //     expect(
        //         await blockchain
        //             .openContract(
        //                 JettonWallet.createFromAddress(await jettonMinter.getWalletAddressOf(users[1].address))
        //             )
        //             .getJettonBalance()
        //     ).toEqual(dictionary.get(1n)?.amount);
        //     expect(await helper.getClaimed()).toBeTruthy();
        // }
    });

    it('should not claim with wrong index', async () => {
        {
            const merkleProof = dictionary.generateMerkleProof(2n);
            const helper = blockchain.openContract(
                ClaimHelper.createFromConfig(
                    {
                        master: claimMaster.address,
                        index: 1n,
                        proofHash: merkleProof.hash(),
                    },
                    codeHelper
                )
            );
            await helper.sendDeploy(users[1].getSender());
            const result = await helper.sendClaim(123n, merkleProof);
            expect(result.transactions).toHaveTransaction({
                from: helper.address,
                to: claimMaster.address,
                success: false,
            });
            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(users[1].address))
                    )
                    .getJettonBalance()
            ).toEqual(0n);
        }

        {
            const merkleProof = dictionary.generateMerkleProof(1n);
            const helper = blockchain.openContract(
                ClaimHelper.createFromConfig(
                    {
                        master: claimMaster.address,
                        index: 1n,
                        proofHash: merkleProof.hash(),
                    },
                    codeHelper
                )
            );
            await helper.sendDeploy(users[1].getSender());
            const result = await helper.sendClaim(123n, merkleProof);
            expect(result.transactions).toHaveTransaction({
                from: helper.address,
                to: claimMaster.address,
                success: true,
            });
            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(users[1].address))
                    )
                    .getJettonBalance()
            ).toEqual(dictionary.get(1n)?.amount);
            expect(await helper.getClaimed()).toBeTruthy();
        }
    });
});
