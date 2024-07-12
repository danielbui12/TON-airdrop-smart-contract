import { Address, Cell, Dictionary } from '@ton/core';
import { claimMasterEntryValue } from '../wrappers/ClaimMaster';
import { NetworkProvider, compile } from '@ton/blueprint';
import { ClaimHelper } from '../wrappers/ClaimHelper';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { waitForStateChange } from './utils';

export async function run(provider: NetworkProvider) {
    // suppose that you have the cell in base64 form stored somewhere
    // const dictCell = Cell.fromBase64(
    //     'te6cckEBBQEAiAACA8/oAgEAT0gBXkdqCILh0PQ2sSrNftE0+xRx9GR+xJncvd79fC43/OKgO5rKABACASAEAwBNIAU2P6YHTTDT6tly8/WYPdWiPp8tPprjhVSyTGLYU5HWYlloLwBAAE8gAh7pcvxa9Gteci/EiIzOJDTnFyED5Kc5dxjfnHn3j7lCi6Q7dABAuXVYSg=='
    // );
    // const dict = dictCell.beginParse().loadDictDirect(Dictionary.Keys.BigUint(256), claimMasterEntryValue);

    const entryIndex = 0n;
    
    // // const proof = dict.generateMerkleProof(entryIndex);
    const proof = Cell.fromBoc(
        Buffer.from('b5ee9c724101060100a60009460375046a1ff82a4de07874b720f71a8156c897f12417cd6de35049ca66c6508a890002012203cfe8030228480101bd23d81f129b1e82b2e9c4131ba97369253a11b639cbbe45b6651857c7a280c200002201200504284801011eee31ac8c6eb0c6af209869284644d334d66d494222fed0ec71adc48803f8030000004d2002f04fa961808c8c0e51ffe862060377ecf162e995734ed64979033922f2d7079201a39de04026e7462e', 'hex')
    )[0]

    const helper = provider.open(
        ClaimHelper.createFromConfig(
            {
                master: Address.parse('EQA99BDUEw0uSkgXQ04KbYPGnGAJtuHwqzMt7SGdBnQ8tWXE'),
                index: entryIndex,
                proofHash: proof.hash(),
            },
            await compile('ClaimHelper')
        )
    );
    console.log('ClaimHelper address:', helper.address);
    

    const isDeployed = await provider.isContractDeployed(helper.address);
    console.log('isDeployed', isDeployed);
    if (!isDeployed) {
        await helper.sendDeploy(provider.sender());
        await provider.waitForDeploy(helper.address);
    }

    const isClaimed = await helper.getClaimed();
    console.log("Is claimed:", isClaimed);
    if (isClaimed) return;

    const jettonMinterAddress = Address.parse('EQCaW2QXjg4cZ1VJmpx9o_4qeJO7uwnPOce5g8JVWR0XQGtq');
    const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddress));
    const jettonWalletAddr = await jettonMinter.getWalletAddress(provider.sender().address!);
    const jettonWallet = provider.open(JettonWallet.createFromAddress(jettonWalletAddr));
    console.log('balance before:', await jettonWallet.getJettonBalance());

    // call claim
    await helper.sendClaim(21n, proof); // 123 -> any query_id

    const balanceAfter = await waitForStateChange(provider.ui(), async () => await jettonWallet.getJettonBalance());
    console.log('balance after', balanceAfter);
    
}
