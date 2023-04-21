import { BLOCK_HASH, BLOCK_NUMBER, TIMESTAMP, CHAIN_ID } from './propertyTypes'

export const blockSpecificProperties = {
    blockHash: {
        name: 'blockHash',
        type: BLOCK_HASH,
    },
    blockNumber: {
        name: 'blockNumber',
        type: BLOCK_NUMBER,
    },
    blockTimestamp: {
        name: 'blockTimestamp',
        type: TIMESTAMP,
        options: { primaryTimestamp: true },
    },
    chainId: {
        name: 'chainId',
        type: CHAIN_ID,
    },
}
