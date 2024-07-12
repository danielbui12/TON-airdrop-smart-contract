import { toNano } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonWallet = provider.open(JettonWallet.createFromConfig({}, await compile('JettonWallet')));

    await jettonWallet.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(jettonWallet.address);
    const openedContract = provider.open(jettonWallet);

    // run methods on `openedContract`
    console.log("Deployed to:", openedContract.address)
}
