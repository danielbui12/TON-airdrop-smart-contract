import { Address, beginCell, toNano } from '@ton/core';
import { ClaimMaster, ClaimMasterEntry, generateEntriesDictionary } from '../wrappers/ClaimMaster';
import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const entries: ClaimMasterEntry[] = [
        {
            address: Address.parse('0QCmx_TA6aYafVsuXn6zB7q0R9Plp9NccKqWSYxbCnI6zC6G'),
            amount: toNano('1'),
        },
        {
            address: Address.parse('0QAq8gmVecI9v5duWUvWKtI70raAgeM8kUWZNJ2ECY8CKXDP'),
            amount: toNano('2'),
        },
        {
            address: Address.parse('0QCvI7UEQXDoehtYlWa_aJp9ijj6Mj9iTO5e736-Fxv-cUmr'),
            amount: toNano('1.5'),
        },
    ];

    const dict = generateEntriesDictionary(entries);
    const dictCell = beginCell().storeDictDirect(dict).endCell();
    console.log(`Dictionary cell (store it somewhere on your backend: ${dictCell.toBoc().toString('base64')}`);
    const merkleRoot = BigInt('0x' + dictCell.hash().toString('hex'));
    const jettonMinterAddress = Address.parse('EQCaW2QXjg4cZ1VJmpx9o_4qeJO7uwnPOce5g8JVWR0XQGtq');
    const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddress));

    const claimMaster = provider.open(
        ClaimMaster.createFromConfig(
            {
                merkleRoot,
                helperCode: await compile('ClaimHelper'),
            },
            await compile('ClaimMaster')
        )
    );
    const claimMasterJettonWallet = await jettonMinter.getWalletAddress(claimMaster.address);
    await claimMaster.sendDeploy(provider.sender(), toNano('0.05'), claimMasterJettonWallet);
    await provider.waitForDeploy(claimMaster.address);

    // await claimMaster.sendDeploy(provider.sender(), toNano('0.05'), claimMasterJettonWallet);
    await jettonMinter.sendMint(provider.sender(), claimMaster.address, toNano('10'), toNano('0.05'), toNano('1'))
}
