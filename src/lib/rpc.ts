import {
    SpecRpcClient,
    Address,
    AbiItem,
    MetaProtocolId,
    ContractCallResponse,
} from '@spec.dev/rpc'
import { StringKeyMap } from './types'
import { ContractCallError, ResolveMetadataError } from './errors'

const rpcClient = new SpecRpcClient()

export async function callContract(
    chainId: string | number,
    contractAddress: Address,
    abiItem: AbiItem | string,
    inputs: any[]
): Promise<ContractCallResponse> {
    try {
        return await rpcClient.call(chainId, contractAddress, abiItem, inputs)
    } catch (err) {
        const method = typeof abiItem === 'string' ? abiItem : abiItem?.name
        throw new ContractCallError(chainId, contractAddress, method, err)
    }
}

export async function resolveMetadata(
    pointer: string,
    options?: {
        protocolId?: MetaProtocolId
        required?: boolean
        fallback?: any
    }
): Promise<StringKeyMap | null> {
    const { protocolId, required, fallback = {} } = options || {}
    try {
        return (await rpcClient.resolveMetadata(pointer, protocolId)) || fallback
    } catch (err) {
        if (required) throw new ResolveMetadataError(pointer, protocolId || null, err)
        console.error(err)
        return fallback
    }
}
