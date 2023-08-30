import ContractMethod from './ContractMethod'
import { Abi, AbiItemType, Address } from '../types'

class Contract {
    _chainId: string

    _address: Address

    _abi: Abi

    _withRpcResponseSyntax: boolean

    constructor(
        chainId: string | number,
        address: Address,
        abi: Abi,
        withRpcResponseSyntax: boolean = true
    ) {
        this._chainId = chainId.toString()
        this._address = address
        this._abi = abi
        this._withRpcResponseSyntax = withRpcResponseSyntax
        this._attachMethods()
    }

    _attachMethods() {
        for (const item of this._abi || []) {
            if (item.type !== AbiItemType.Function) continue
            const method = new ContractMethod(
                this._chainId,
                this._address,
                item,
                this._withRpcResponseSyntax
            )
            this[item.name] = async (...inputs: any[]) => method.call(...inputs)
        }
    }
}

export default Contract
