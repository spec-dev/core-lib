import { MetaProtocolId } from './types'
import { stringify } from './utils/formatters'

export class QueryError extends Error {
    constructor(op: string, table: string, error: any) {
        super(`(op=${op}; table=${table}: ${stringify(error, error)}`)
        this.name = 'Query Error'
    }
}

export class ContractCallError extends Error {
    constructor(chainId: string | number, address: string, method: string, error: any) {
        super(
            `(chainId=${chainId}; address=${address}; method=${method}: ${stringify(error, error)}`
        )
        this.name = 'Contract Call Error'
    }
}

export class ResolveMetadataError extends Error {
    constructor(pointer: string, protocolId: MetaProtocolId | null, error: any) {
        super(`(pointer=${pointer}; protocolId=${protocolId}; ${stringify(error, error)}`)
        this.name = 'Metadata Resolution Error'
    }
}
