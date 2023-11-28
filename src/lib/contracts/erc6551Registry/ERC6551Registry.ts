import abi from './abi'
import ContractMethod from '../ContractMethod'
import { Address, Abi, AbiItemType } from '../../types'
import { ContractType } from '../types'

const DEFAULT_REGISTRY_ADDRESS = '0x000000006551c19487814612e58fe06813775758'

class ERC6551Registry {
    protected _chainId: string

    protected _address: Address

    protected _abi: Abi

    protected _methods: { [key: string]: Function }

    constructor(chainId: string | number, address?: Address) {
        this._chainId = chainId.toString()
        this._address = address || DEFAULT_REGISTRY_ADDRESS
        this._abi = abi
        this._attachMethods()
    }

    private _attachMethods() {
        this._methods = {}
        for (const item of this._abi || []) {
            if (item.type !== AbiItemType.Function) continue
            const method = new ContractMethod(this._chainId, this._address, item)
            this._methods[item.name] = async (...inputs: any[]) => method.call(...inputs)
        }
    }

    /**
     * @param implementation Type: address
     * @param salt Type: bytes32
     * @param chainId Type: uint256
     * @param tokenContract Type: address
     * @param tokenId Type: uint256
     */
    async account(
        implementation: ContractType.Address,
        salt: ContractType.Bytes,
        chainId: ContractType.Number,
        tokenContract: ContractType.Address,
        tokenId: ContractType.Number
    ): Promise<ContractType.Address> {
        return this._methods.account(
            implementation,
            salt.toString(),
            chainId.toString(),
            tokenContract,
            tokenId.toString()
        )
    }

    /**
     * @param implementation Type: address
     * @param salt Type: bytes32
     * @param chainId Type: uint256
     * @param tokenContract Type: address
     * @param tokenId Type: uint256
     */
    async createAccount(
        implementation: ContractType.Address,
        salt: ContractType.Bytes,
        chainId: ContractType.Number,
        tokenContract: ContractType.Address,
        tokenId: ContractType.Number
    ): Promise<ContractType.Address> {
        return this._methods.createAccount(
            implementation,
            salt.toString(),
            chainId.toString(),
            tokenContract,
            tokenId.toString()
        )
    }
}

export default ERC6551Registry
