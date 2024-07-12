import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, toNano } from '@ton/core';

export type ClaimHelperConfig = {
    master: Address;
    proofHash: Buffer;
    index: bigint;
};

export function claimMasterHelperConfigToCell(config: ClaimHelperConfig): Cell {
    return beginCell()
        .storeBit(false)
        .storeAddress(config.master)
        .storeBuffer(config.proofHash, 32)
        .storeUint(config.index, 256)
        .endCell();
}

export class ClaimHelper implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new ClaimHelper(address);
    }

    static createFromConfig(config: ClaimHelperConfig, code: Cell, workchain = 0) {
        const data = claimMasterHelperConfigToCell(config);
        const init = { code, data };
        return new ClaimHelper(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.15'),
        });
    }

    async sendClaim(provider: ContractProvider, queryId: bigint, proof: Cell) {
        await provider.external(beginCell().storeUint(queryId, 64).storeRef(proof).endCell());
    }

    async getClaimed(provider: ContractProvider): Promise<boolean> {
        if ((await provider.getState()).state.type == 'uninit') {
            return false;
        }
        const stack = (await provider.get('get_claimed', [])).stack;
        return stack.readBoolean();
    }
}
