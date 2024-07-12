import {
    Dictionary,
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    Builder,
    Slice,
} from '@ton/core';

export type ClaimMasterConfig = {
    merkleRoot: bigint;
    helperCode: Cell;
};

export function claimMasterConfigToCell(config: ClaimMasterConfig): Cell {
    return beginCell()
        .storeUint(0, 2)
        .storeUint(config.merkleRoot, 256)
        .storeRef(config.helperCode)
        .storeUint(Math.floor(Math.random() * 1e9), 64)
        .endCell();
}

export type ClaimMasterEntry = {
    address: Address;
    amount: bigint;
};

export const claimMasterEntryValue = {
    serialize: (src: ClaimMasterEntry, buidler: Builder) => {
        buidler.storeAddress(src.address).storeCoins(src.amount);
    },
    parse: (src: Slice) => {
        return {
            address: src.loadAddress(),
            amount: src.loadCoins(),
        };
    },
};

export function generateEntriesDictionary(entries: ClaimMasterEntry[]): Dictionary<bigint, ClaimMasterEntry> {
    let dict: Dictionary<bigint, ClaimMasterEntry> = Dictionary.empty(Dictionary.Keys.BigUint(256), claimMasterEntryValue);

    for (let i = 0; i < entries.length; i++) {
        dict.set(BigInt(i), entries[i]);
    }

    return dict;
}

export class ClaimMaster implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new ClaimMaster(address);
    }

    static createFromConfig(config: ClaimMasterConfig, code: Cell, workchain = 0) {
        const data = claimMasterConfigToCell(config);
        const init = { code, data };
        return new ClaimMaster(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint, jettonWallet: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x610ca46c, 32).storeUint(0, 64).storeAddress(jettonWallet).endCell(),
        });
    }
}
