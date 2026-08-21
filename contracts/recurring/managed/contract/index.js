import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

class _SubscriptionRecord_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_4.alignment()))))))));
  }
  fromValue(value_0) {
    return {
      payer: _descriptor_0.fromValue(value_0),
      recipient: _descriptor_0.fromValue(value_0),
      amount: _descriptor_1.fromValue(value_0),
      frequency: _descriptor_2.fromValue(value_0),
      nextPaymentTime: _descriptor_2.fromValue(value_0),
      endTime: _descriptor_2.fromValue(value_0),
      maxPayments: _descriptor_3.fromValue(value_0),
      paymentCount: _descriptor_3.fromValue(value_0),
      status: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.payer).concat(_descriptor_0.toValue(value_0.recipient).concat(_descriptor_1.toValue(value_0.amount).concat(_descriptor_2.toValue(value_0.frequency).concat(_descriptor_2.toValue(value_0.nextPaymentTime).concat(_descriptor_2.toValue(value_0.endTime).concat(_descriptor_3.toValue(value_0.maxPayments).concat(_descriptor_3.toValue(value_0.paymentCount).concat(_descriptor_4.toValue(value_0.status)))))))));
  }
}

const _descriptor_5 = new _SubscriptionRecord_0();

const _descriptor_6 = __compactRuntime.CompactTypeBoolean;

class _Either_0 {
  alignment() {
    return _descriptor_6.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_6.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_6.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_7 = new _Either_0();

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

const _descriptor_8 = new _ContractAddress_0();

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
      createSubscription: (...args_1) => {
        if (args_1.length !== 9) {
          throw new __compactRuntime.CompactError(`createSubscription: expected 9 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const subscriptionId_0 = args_1[1];
        const payer_0 = args_1[2];
        const recipient_0 = args_1[3];
        const amount_0 = args_1[4];
        const frequency_0 = args_1[5];
        const nextPaymentTime_0 = args_1[6];
        const endTime_0 = args_1[7];
        const maxPayments_0 = args_1[8];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 1 (as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(subscriptionId_0.buffer instanceof ArrayBuffer && subscriptionId_0.BYTES_PER_ELEMENT === 1 && subscriptionId_0.length === 32)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Bytes<32>',
                                     subscriptionId_0)
        }
        if (!(payer_0.buffer instanceof ArrayBuffer && payer_0.BYTES_PER_ELEMENT === 1 && payer_0.length === 32)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Bytes<32>',
                                     payer_0)
        }
        if (!(recipient_0.buffer instanceof ArrayBuffer && recipient_0.BYTES_PER_ELEMENT === 1 && recipient_0.length === 32)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Bytes<32>',
                                     recipient_0)
        }
        if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Uint<0..340282366920938463463374607431768211456>',
                                     amount_0)
        }
        if (!(typeof(frequency_0) === 'bigint' && frequency_0 >= 0n && frequency_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Uint<0..18446744073709551616>',
                                     frequency_0)
        }
        if (!(typeof(nextPaymentTime_0) === 'bigint' && nextPaymentTime_0 >= 0n && nextPaymentTime_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Uint<0..18446744073709551616>',
                                     nextPaymentTime_0)
        }
        if (!(typeof(endTime_0) === 'bigint' && endTime_0 >= 0n && endTime_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 7 (argument 8 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Uint<0..18446744073709551616>',
                                     endTime_0)
        }
        if (!(typeof(maxPayments_0) === 'bigint' && maxPayments_0 >= 0n && maxPayments_0 <= 4294967295n)) {
          __compactRuntime.typeError('createSubscription',
                                     'argument 8 (argument 9 as invoked from Typescript)',
                                     'recurring.compact line 29 char 1',
                                     'Uint<0..4294967296>',
                                     maxPayments_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(subscriptionId_0).concat(_descriptor_0.toValue(payer_0).concat(_descriptor_0.toValue(recipient_0).concat(_descriptor_1.toValue(amount_0).concat(_descriptor_2.toValue(frequency_0).concat(_descriptor_2.toValue(nextPaymentTime_0).concat(_descriptor_2.toValue(endTime_0).concat(_descriptor_3.toValue(maxPayments_0)))))))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment())))))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._createSubscription_0(context,
                                                    partialProofData,
                                                    subscriptionId_0,
                                                    payer_0,
                                                    recipient_0,
                                                    amount_0,
                                                    frequency_0,
                                                    nextPaymentTime_0,
                                                    endTime_0,
                                                    maxPayments_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      executePayment: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`executePayment: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const subscriptionId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        const currentTime_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('executePayment',
                                     'argument 1 (as invoked from Typescript)',
                                     'recurring.compact line 69 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(subscriptionId_0.buffer instanceof ArrayBuffer && subscriptionId_0.BYTES_PER_ELEMENT === 1 && subscriptionId_0.length === 32)) {
          __compactRuntime.typeError('executePayment',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'recurring.compact line 69 char 1',
                                     'Bytes<32>',
                                     subscriptionId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('executePayment',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'recurring.compact line 69 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        if (!(typeof(currentTime_0) === 'bigint' && currentTime_0 >= 0n && currentTime_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('executePayment',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'recurring.compact line 69 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentTime_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(subscriptionId_0).concat(_descriptor_0.toValue(callerPk_0).concat(_descriptor_2.toValue(currentTime_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._executePayment_0(context,
                                                partialProofData,
                                                subscriptionId_0,
                                                callerPk_0,
                                                currentTime_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      pauseSubscription: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`pauseSubscription: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const subscriptionId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('pauseSubscription',
                                     'argument 1 (as invoked from Typescript)',
                                     'recurring.compact line 103 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(subscriptionId_0.buffer instanceof ArrayBuffer && subscriptionId_0.BYTES_PER_ELEMENT === 1 && subscriptionId_0.length === 32)) {
          __compactRuntime.typeError('pauseSubscription',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'recurring.compact line 103 char 1',
                                     'Bytes<32>',
                                     subscriptionId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('pauseSubscription',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'recurring.compact line 103 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(subscriptionId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._pauseSubscription_0(context,
                                                   partialProofData,
                                                   subscriptionId_0,
                                                   callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      resumeSubscription: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`resumeSubscription: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const subscriptionId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('resumeSubscription',
                                     'argument 1 (as invoked from Typescript)',
                                     'recurring.compact line 130 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(subscriptionId_0.buffer instanceof ArrayBuffer && subscriptionId_0.BYTES_PER_ELEMENT === 1 && subscriptionId_0.length === 32)) {
          __compactRuntime.typeError('resumeSubscription',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'recurring.compact line 130 char 1',
                                     'Bytes<32>',
                                     subscriptionId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('resumeSubscription',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'recurring.compact line 130 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(subscriptionId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._resumeSubscription_0(context,
                                                    partialProofData,
                                                    subscriptionId_0,
                                                    callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      cancelSubscription: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`cancelSubscription: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const subscriptionId_0 = args_1[1];
        const callerPk_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('cancelSubscription',
                                     'argument 1 (as invoked from Typescript)',
                                     'recurring.compact line 157 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(subscriptionId_0.buffer instanceof ArrayBuffer && subscriptionId_0.BYTES_PER_ELEMENT === 1 && subscriptionId_0.length === 32)) {
          __compactRuntime.typeError('cancelSubscription',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'recurring.compact line 157 char 1',
                                     'Bytes<32>',
                                     subscriptionId_0)
        }
        if (!(callerPk_0.buffer instanceof ArrayBuffer && callerPk_0.BYTES_PER_ELEMENT === 1 && callerPk_0.length === 32)) {
          __compactRuntime.typeError('cancelSubscription',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'recurring.compact line 157 char 1',
                                     'Bytes<32>',
                                     callerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(subscriptionId_0).concat(_descriptor_0.toValue(callerPk_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._cancelSubscription_0(context,
                                                    partialProofData,
                                                    subscriptionId_0,
                                                    callerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      createSubscription: this.circuits.createSubscription,
      executePayment: this.circuits.executePayment,
      pauseSubscription: this.circuits.pauseSubscription,
      resumeSubscription: this.circuits.resumeSubscription,
      cancelSubscription: this.circuits.cancelSubscription
    };
    this.provableCircuits = {
      createSubscription: this.circuits.createSubscription,
      executePayment: this.circuits.executePayment,
      pauseSubscription: this.circuits.pauseSubscription,
      resumeSubscription: this.circuits.resumeSubscription,
      cancelSubscription: this.circuits.cancelSubscription
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
    state_0.setOperation('createSubscription', new __compactRuntime.ContractOperation());
    state_0.setOperation('executePayment', new __compactRuntime.ContractOperation());
    state_0.setOperation('pauseSubscription', new __compactRuntime.ContractOperation());
    state_0.setOperation('resumeSubscription', new __compactRuntime.ContractOperation());
    state_0.setOperation('cancelSubscription', new __compactRuntime.ContractOperation());
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
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
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
  _createSubscription_0(context,
                        partialProofData,
                        subscriptionId_0,
                        payer_0,
                        recipient_0,
                        amount_0,
                        frequency_0,
                        nextPaymentTime_0,
                        endTime_0,
                        maxPayments_0)
  {
    const public_id_0 = subscriptionId_0;
    const public_payer_0 = payer_0;
    const public_recipient_0 = recipient_0;
    const public_amount_0 = amount_0;
    const public_frequency_0 = frequency_0;
    const public_next_time_0 = nextPaymentTime_0;
    const public_end_time_0 = endTime_0;
    const public_max_payments_0 = maxPayments_0;
    __compactRuntime.assert(!_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_4.toValue(0n),
                                                                                                                   alignment: _descriptor_4.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Subscription ID already exists');
    __compactRuntime.assert(public_amount_0 > 0n,
                            'Amount must be greater than zero');
    __compactRuntime.assert(public_frequency_0 > 0n,
                            'Frequency must be greater than zero');
    __compactRuntime.assert(!this._equal_0(public_payer_0, public_recipient_0),
                            'Payer and recipient must be different');
    __compactRuntime.assert(public_end_time_0 >= public_next_time_0,
                            'End time must be after next payment time');
    const tmp_0 = { payer: public_payer_0,
                    recipient: public_recipient_0,
                    amount: public_amount_0,
                    frequency: public_frequency_0,
                    nextPaymentTime: public_next_time_0,
                    endTime: public_end_time_0,
                    maxPayments: public_max_payments_0,
                    paymentCount: 0n,
                    status: 1n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(0n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _executePayment_0(context,
                    partialProofData,
                    subscriptionId_0,
                    callerPk_0,
                    currentTime_0)
  {
    const public_id_0 = subscriptionId_0;
    const public_caller_0 = callerPk_0;
    const public_current_time_0 = currentTime_0;
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(0n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Subscription does not exist');
    const sub_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(0n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                        alignment: _descriptor_0.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.assert(this._equal_1(sub_0.status, 1n),
                            'Subscription must be ACTIVE to execute payment');
    __compactRuntime.assert(public_current_time_0 >= sub_0.nextPaymentTime,
                            'Payment executed too early');
    __compactRuntime.assert(public_current_time_0 <= sub_0.endTime,
                            'Subscription has passed end time');
    const newCount_0 = ((t1) => {
                         if (t1 > 4294967295n) {
                           throw new __compactRuntime.CompactError('recurring.compact line 85 char 20: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                         }
                         return t1;
                       })(sub_0.paymentCount + 1n);
    let t_0, t_1;
    const isFinal_0 = (t_1 = sub_0.maxPayments, t_1 > 0n)
                      &&
                      newCount_0 >= sub_0.maxPayments
                      ||
                      (t_0 = sub_0.nextPaymentTime + sub_0.frequency,
                       t_0 > sub_0.endTime);
    const nextTime_0 = ((t1) => {
                         if (t1 > 18446744073709551615n) {
                           throw new __compactRuntime.CompactError('recurring.compact line 87 char 20: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                         }
                         return t1;
                       })(sub_0.nextPaymentTime + sub_0.frequency);
    const tmp_0 = { payer: sub_0.payer,
                    recipient: sub_0.recipient,
                    amount: sub_0.amount,
                    frequency: sub_0.frequency,
                    nextPaymentTime: nextTime_0,
                    endTime: sub_0.endTime,
                    maxPayments: sub_0.maxPayments,
                    paymentCount: newCount_0,
                    status: isFinal_0 ? 4n : 1n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(0n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _pauseSubscription_0(context, partialProofData, subscriptionId_0, callerPk_0)
  {
    const public_id_0 = subscriptionId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(0n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Subscription does not exist');
    const sub_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(0n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                        alignment: _descriptor_0.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.assert(this._equal_2(sub_0.status, 1n),
                            'Subscription must be ACTIVE to pause');
    __compactRuntime.assert(this._equal_3(sub_0.payer, public_caller_0),
                            'Only payer can pause subscription');
    const tmp_0 = { payer: sub_0.payer,
                    recipient: sub_0.recipient,
                    amount: sub_0.amount,
                    frequency: sub_0.frequency,
                    nextPaymentTime: sub_0.nextPaymentTime,
                    endTime: sub_0.endTime,
                    maxPayments: sub_0.maxPayments,
                    paymentCount: sub_0.paymentCount,
                    status: 2n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(0n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _resumeSubscription_0(context, partialProofData, subscriptionId_0, callerPk_0)
  {
    const public_id_0 = subscriptionId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(0n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Subscription does not exist');
    const sub_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(0n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                        alignment: _descriptor_0.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.assert(this._equal_4(sub_0.status, 2n),
                            'Subscription must be PAUSED to resume');
    __compactRuntime.assert(this._equal_5(sub_0.payer, public_caller_0),
                            'Only payer can resume subscription');
    const tmp_0 = { payer: sub_0.payer,
                    recipient: sub_0.recipient,
                    amount: sub_0.amount,
                    frequency: sub_0.frequency,
                    nextPaymentTime: sub_0.nextPaymentTime,
                    endTime: sub_0.endTime,
                    maxPayments: sub_0.maxPayments,
                    paymentCount: sub_0.paymentCount,
                    status: 1n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(0n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _cancelSubscription_0(context, partialProofData, subscriptionId_0, callerPk_0)
  {
    const public_id_0 = subscriptionId_0;
    const public_caller_0 = callerPk_0;
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_4.toValue(0n),
                                                                                                                  alignment: _descriptor_4.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Subscription does not exist');
    const sub_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                            partialProofData,
                                                                            [
                                                                             { dup: { n: 0 } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_4.toValue(0n),
                                                                                                        alignment: _descriptor_4.alignment() } }] } },
                                                                             { idx: { cached: false,
                                                                                      pushPath: false,
                                                                                      path: [
                                                                                             { tag: 'value',
                                                                                               value: { value: _descriptor_0.toValue(public_id_0),
                                                                                                        alignment: _descriptor_0.alignment() } }] } },
                                                                             { popeq: { cached: false,
                                                                                        result: undefined } }]).value);
    __compactRuntime.assert(this._equal_6(sub_0.status, 1n)
                            ||
                            this._equal_7(sub_0.status, 2n),
                            'Subscription must be ACTIVE or PAUSED to cancel');
    __compactRuntime.assert(this._equal_8(sub_0.payer, public_caller_0)
                            ||
                            this._equal_9(sub_0.recipient, public_caller_0),
                            'Only payer or recipient can cancel');
    const tmp_0 = { payer: sub_0.payer,
                    recipient: sub_0.recipient,
                    amount: sub_0.amount,
                    frequency: sub_0.frequency,
                    nextPaymentTime: sub_0.nextPaymentTime,
                    endTime: sub_0.endTime,
                    maxPayments: sub_0.maxPayments,
                    paymentCount: sub_0.paymentCount,
                    status: 3n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_4.toValue(0n),
                                                                  alignment: _descriptor_4.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(public_id_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
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
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_8(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_9(x0, y0) {
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
    subscriptions: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(0n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                                                 alignment: _descriptor_2.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(0n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
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
                                     'recurring.compact line 24 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_4.toValue(0n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
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
                                     'recurring.compact line 24 char 1',
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
                                                                                            value: { value: _descriptor_4.toValue(0n),
                                                                                                     alignment: _descriptor_4.alignment() } }] } },
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
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_5.fromValue(value.value)    ];  })[Symbol.iterator]();
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
