import { ContractCallResponse } from '@spec.dev/rpc'
import { callContract } from '../rpc'
import { AbiItem, Address } from '../types'

class ContractMethod {
    chainId: string | number

    contractAddress: Address

    abiItem: AbiItem | string

    constructor(chainId: string | number, contractAddress: Address, abiItem: AbiItem | string) {
        this.chainId = chainId
        this.contractAddress = contractAddress
        this.abiItem = abiItem
    }

    async call(...inputs: any[]): Promise<ContractCallResponse> {
        return callContract(this.chainId, this.contractAddress, this.abiItem, inputs)
    }
}

export default ContractMethod
