import ContractMethod from './ContractMethod'
import { Abi, AbiItemType, Address } from '../types'

class Contract {
    _chainId: string

    _address: Address

    _abi: Abi

    constructor(chainId: string | number, address: Address, abi: Abi) {
        this._chainId = chainId.toString()
        this._address = address
        this._abi = abi
        this._attachMethods()
    }

    _attachMethods() {
        for (const item of this._abi || []) {
            if (item.type !== AbiItemType.Function) continue
            const method = new ContractMethod(this._chainId, this._address, item)
            this[item.name] = async (...inputs: any[]) => method.call(...inputs)
        }
    }
}

export default Contract
