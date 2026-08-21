import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _EscrowRecord_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment()))))));
  }
  fromValue(value_0) {
    return {
      payer: _descriptor_0.fromValue(value_0),
      payee: _descriptor_0.fromValue(value_0),
      arbiter: _descriptor_0.fromValue(value_0),
      amount: _descriptor_1.fromValue(value_0),
      status: _descriptor_2.fromValue(value_0),
      createdAt: _descriptor_3.fromValue(value_0),
      deadline: _descriptor_3.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.payer).concat(_descriptor_0.toValue(value_0.payee).concat(_descriptor_0.toValue(value_0.arbiter).concat(_descriptor_1.toValue(value_0.amount).concat(_descriptor_2.toValue(value_0.status).concat(_descriptor_3.toValue(value_0.createdAt).concat(_descriptor_3.toValue(value_0.deadline)))))));
  }
}

const _descriptor_4 = new _EscrowRecord_0();

const _descriptor_5 = __compactRuntime.CompactTypeBoolean;

class _Either_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_5.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_6 = new _Either_0();

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_7 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      createEscrow: (...args_1) => {
        if (args_1.length !== 8) {
          throw new __compactRuntime.CompactError(`createEscrow: expected 8 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const payer_0 = args_1[2];
        const payee_0 = args_1[3];
        const arbiter_0 = args_1[4];
        const amount_0 = args_1[5];
        const createdAt_0 = args_1[6];
        const deadline_0 = args_1[7];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(payer_0.buffer instanceof ArrayBuffer && payer_0.BYTES_PER_ELEMENT === 1 && payer_0.length === 32)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Bytes<32>',
                                     payer_0)
        }
        if (!(payee_0.buffer instanceof ArrayBuffer && payee_0.BYTES_PER_ELEMENT === 1 && payee_0.length === 32)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Bytes<32>',
                                     payee_0)
        }
        if (!(arbiter_0.buffer instanceof ArrayBuffer && arbiter_0.BYTES_PER_ELEMENT === 1 && arbiter_0.length === 32)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Bytes<32>',
                                     arbiter_0)
        }
        if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Uint<0..340282366920938463463374607431768211456>',
                                     amount_0)
        }
        if (!(typeof(createdAt_0) === 'bigint' && createdAt_0 >= 0n && createdAt_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Uint<0..18446744073709551616>',
                                     createdAt_0)
        }
        if (!(typeof(deadline_0) === 'bigint' && deadline_0 >= 0n && deadline_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createEscrow',
                                     'argument 7 (argument 8 as invoked from Typescript)',
                                     'escrow.compact line 27 char 1',
                                     'Uint<0..18446744073709551616>',
                                     deadline_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(payer_0).concat(_descriptor_0.toValue(payee_0).concat(_descriptor_0.toValue(arbiter_0).concat(_descriptor_1.toValue(amount_0).concat(_descriptor_3.toValue(createdAt_0).concat(_descriptor_3.toValue(deadline_0))))))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment()))))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._createEscrow_0(context,
                                              partialProofData,
                                              escrowId_0,
                                              payer_0,
                                              payee_0,
                                              arbiter_0,
                                              amount_0,
                                              createdAt_0,
                                              deadline_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      fundEscrow: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`fundEscrow: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('fundEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 61 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('fundEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 61 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('fundEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 61 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._fundEscrow_0(context,
                                            partialProofData,
                                            escrowId_0,
                                            callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      lockEscrow: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`lockEscrow: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('lockEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 86 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('lockEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 86 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('lockEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 86 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._lockEscrow_0(context,
                                            partialProofData,
                                            escrowId_0,
                                            callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      releaseEscrow: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`releaseEscrow: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('releaseEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 111 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('releaseEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 111 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('releaseEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 111 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._releaseEscrow_0(context,
                                               partialProofData,
                                               escrowId_0,
                                               callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      refundEscrow: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`refundEscrow: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        const currentTime_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('refundEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 136 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('refundEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 136 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('refundEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 136 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        if (!(typeof(currentTime_0) === 'bigint' && currentTime_0 >= 0n && currentTime_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('refundEscrow',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'escrow.compact line 136 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentTime_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(callerPk_0).concat(_descriptor_3.toValue(currentTime_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._refundEscrow_0(context,
                                              partialProofData,
                                              escrowId_0,
                                              callerPk_0,
                                              currentTime_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      cancelEscrow: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`cancelEscrow: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const escrowId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('cancelEscrow',
                                     'argument 1 (as invoked from Typescript)',
                                     'escrow.compact line 169 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(escrowId_0.buffer instanceof ArrayBuffer && escrowId_0.BYTES_PER_ELEMENT === 1 && escrowId_0.length === 32)) {
          __compactRuntime.typeError('cancelEscrow',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'escrow.compact line 169 char 1',
                                     'Bytes<32>',
                                     escrowId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('cancelEscrow',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'escrow.compact line 169 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(escrowId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._cancelEscrow_0(context,
                                              partialProofData,
                                              escrowId_0,
                                              callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      createEscrow: this.circuits.createEscrow,
      fundEscrow: this.circuits.fundEscrow,
      lockEscrow: this.circuits.lockEscrow,
      releaseEscrow: this.circuits.releaseEscrow,
      refundEscrow: this.circuits.refundEscrow,
      cancelEscrow: this.circuits.cancelEscrow
    };
    this.provableCircuits = {
      createEscrow: this.circuits.createEscrow,
      fundEscrow: this.circuits.fundEscrow,
      lockEscrow: this.circuits.lockEscrow,
      releaseEscrow: this.circuits.releaseEscrow,
      refundEscrow: this.circuits.refundEscrow,
      cancelEscrow: this.circuits.cancelEscrow
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('createEscrow', new __compactRuntime.ContractOperation());
    state_0.setOperation('fundEscrow', new __compactRuntime.ContractOperation());
    state_0.setOperation('lockEscrow', new __compactRuntime.ContractOperation());
    state_0.setOperation('releaseEscrow', new __compactRuntime.ContractOperation());
    state_0.setOperation('refundEscrow', new __compactRuntime.ContractOperation());
    state_0.setOperation('cancelEscrow', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _createEscrow_0(context,
                  partialProofData,
                  escrowId_0,
                  payer_0,
                  payee_0,
                  arbiter_0,
                  amount_0,
                  createdAt_0,
                  deadline_0)
  {
    const public_id_0 = escrowId_0;
    const public_payer_0 = payer_0;
    const public_payee_0 = payee_0;
    const public_arbiter_0 = arbiter_0;
    const public_amount_0 = amount_0;
    const public_created_at_0 = createdAt_0;
    const public_deadline_0 = deadline_0;
    __compactRuntime.assert(!_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_2.toValue(0n),
                                                                                                                   alignment: _descriptor_2.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Escrow ID already exists');
    __compactRuntime.assert(public_amount_0 > 0n,
                            'Amount must be greater than zero');
    __compactRuntime.assert(public_deadline_0 > public_created_at_0,
                            'Deadline must be after creation time');
    __compactRuntime.assert(!this._equal_0(public_payer_0, public_payee_0),
                            'Payer and payee must be different');
    const tmp_0 = { payer: public_payer_0,
                    payee: public_payee_0,
                    arbiter: public_arbiter_0,
                    amount: public_amount_0,
                    status: 0n,
                    createdAt: public_created_at_0,
                    deadline: public_deadline_0 };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _fundEscrow_0(context, partialProofData, escrowId_0, callerPk_0) {
    const public_id_0 = escrowId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(0n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Escrow does not exist');
    const escrow_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_2.toValue(0n),
                                                                                                           alignment: _descriptor_2.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_1(escrow_0.status, 0n),
                            'Escrow must be in CREATED state to fund');
    __compactRuntime.assert(this._equal_2(escrow_0.payer, public_caller_0),
                            'Only the payer can fund this escrow');
    const tmp_0 = { payer: escrow_0.payer,
                    payee: escrow_0.payee,
                    arbiter: escrow_0.arbiter,
                    amount: escrow_0.amount,
                    status: 1n,
                    createdAt: escrow_0.createdAt,
                    deadline: escrow_0.deadline };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _lockEscrow_0(context, partialProofData, escrowId_0, callerPk_0) {
    const public_id_0 = escrowId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(0n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Escrow does not exist');
    const escrow_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_2.toValue(0n),
                                                                                                           alignment: _descriptor_2.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_3(escrow_0.status, 1n),
                            'Escrow must be in FUNDED state to lock');
    __compactRuntime.assert(this._equal_4(escrow_0.payer, public_caller_0),
                            'Only the payer can lock this escrow');
    const tmp_0 = { payer: escrow_0.payer,
                    payee: escrow_0.payee,
                    arbiter: escrow_0.arbiter,
                    amount: escrow_0.amount,
                    status: 2n,
                    createdAt: escrow_0.createdAt,
                    deadline: escrow_0.deadline };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _releaseEscrow_0(context, partialProofData, escrowId_0, callerPk_0) {
    const public_id_0 = escrowId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(0n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Escrow does not exist');
    const escrow_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_2.toValue(0n),
                                                                                                           alignment: _descriptor_2.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_5(escrow_0.status, 2n),
                            'Escrow must be in LOCKED state to release');
    __compactRuntime.assert(this._equal_6(escrow_0.payee, public_caller_0)
                            ||
                            this._equal_7(escrow_0.arbiter, public_caller_0),
                            'Only payee or arbiter can release escrow');
    const tmp_0 = { payer: escrow_0.payer,
                    payee: escrow_0.payee,
                    arbiter: escrow_0.arbiter,
                    amount: escrow_0.amount,
                    status: 3n,
                    createdAt: escrow_0.createdAt,
                    deadline: escrow_0.deadline };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _refundEscrow_0(context,
                  partialProofData,
                  escrowId_0,
                  callerPk_0,
                  currentTime_0)
  {
    const public_id_0 = escrowId_0;
    const public_caller_0 = callerPk_0;
    const public_current_time_0 = currentTime_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(0n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Escrow does not exist');
    const escrow_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_2.toValue(0n),
                                                                                                           alignment: _descriptor_2.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_8(escrow_0.status, 1n)
                            ||
                            this._equal_9(escrow_0.status, 2n),
                            'Escrow must be in FUNDED or LOCKED state to refund');
    if (this._equal_10(escrow_0.arbiter, public_caller_0)) {
    } else {
      __compactRuntime.assert(this._equal_11(escrow_0.payer, public_caller_0),
                              'Only payer or arbiter can refund');
      __compactRuntime.assert(public_current_time_0 >= escrow_0.deadline,
                              'Payer can only refund after deadline');
    }
    const tmp_0 = { payer: escrow_0.payer,
                    payee: escrow_0.payee,
                    arbiter: escrow_0.arbiter,
                    amount: escrow_0.amount,
                    status: 4n,
                    createdAt: escrow_0.createdAt,
                    deadline: escrow_0.deadline };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _cancelEscrow_0(context, partialProofData, escrowId_0, callerPk_0) {
    const public_id_0 = escrowId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_2.toValue(0n),
                                                                                                                  alignment: _descriptor_2.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Escrow does not exist');
    const escrow_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_2.toValue(0n),
                                                                                                           alignment: _descriptor_2.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_12(escrow_0.status, 0n),
                            'Escrow can only be cancelled in CREATED state');
    __compactRuntime.assert(this._equal_13(escrow_0.payer, public_caller_0),
                            'Only payer can cancel this escrow');
    const tmp_0 = { payer: escrow_0.payer,
                    payee: escrow_0.payee,
                    arbiter: escrow_0.arbiter,
                    amount: escrow_0.amount,
                    status: 5n,
                    createdAt: escrow_0.createdAt,
                    deadline: escrow_0.deadline };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_2.toValue(0n),
                                                                  alignment: _descriptor_2.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(tmp_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_8(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_9(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_10(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_11(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_12(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_13(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    escrows: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(0n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(0n),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(0n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'escrow.compact line 22 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(0n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'escrow.compact line 22 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(0n),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_4.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({ });
export const pureCircuits = {};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
