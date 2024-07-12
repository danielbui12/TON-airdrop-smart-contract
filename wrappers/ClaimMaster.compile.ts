import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'func',
    targets: ['stdlib.fc', 'claimer/constants.fc', 'claimer/claim-master.fc'],
};
