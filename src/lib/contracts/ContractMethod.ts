import { callContract } from '../rpc'
import { AbiItem, Address } from '../types'

class ContractMethod {
    chainId: string | number

    contractAddress: Address

    abiItem: AbiItem | string

    withRpcResponseSyntax: boolean

    constructor(
        chainId: string | number,
        contractAddress: Address,
        abiItem: AbiItem | string,
        withRpcResponseSyntax: boolean = true
    ) {
        this.chainId = chainId
        this.contractAddress = contractAddress
        this.abiItem = abiItem
        this.withRpcResponseSyntax = withRpcResponseSyntax
    }

    async call(...inputs: any[]): Promise<any> {
        const resp = await callContract(this.chainId, this.contractAddress, this.abiItem, inputs)
        if (!this.withRpcResponseSyntax) return resp

        const { outputArgs } = resp
        if (outputArgs.length === 0) {
            return null
        } else if (outputArgs.length === 1) {
            return outputArgs[0]
        } else {
            return outputArgs
        }
    }
}

export default ContractMethod
