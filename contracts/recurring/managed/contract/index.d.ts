import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type SubscriptionRecord = { payer: Uint8Array;
                                   recipient: Uint8Array;
                                   amount: bigint;
                                   frequency: bigint;
                                   nextPaymentTime: bigint;
                                   endTime: bigint;
                                   maxPayments: bigint;
                                   paymentCount: bigint;
                                   status: bigint
                                 };

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  createSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     payer_0: Uint8Array,
                     recipient_0: Uint8Array,
                     amount_0: bigint,
                     frequency_0: bigint,
                     nextPaymentTime_0: bigint,
                     endTime_0: bigint,
                     maxPayments_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executePayment(context: __compactRuntime.CircuitContext<PS>,
                 subscriptionId_0: Uint8Array,
                 callerPk_0: Uint8Array,
                 currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pauseSubscription(context: __compactRuntime.CircuitContext<PS>,
                    subscriptionId_0: Uint8Array,
                    callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resumeSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancelSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     payer_0: Uint8Array,
                     recipient_0: Uint8Array,
                     amount_0: bigint,
                     frequency_0: bigint,
                     nextPaymentTime_0: bigint,
                     endTime_0: bigint,
                     maxPayments_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executePayment(context: __compactRuntime.CircuitContext<PS>,
                 subscriptionId_0: Uint8Array,
                 callerPk_0: Uint8Array,
                 currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pauseSubscription(context: __compactRuntime.CircuitContext<PS>,
                    subscriptionId_0: Uint8Array,
                    callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resumeSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancelSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     payer_0: Uint8Array,
                     recipient_0: Uint8Array,
                     amount_0: bigint,
                     frequency_0: bigint,
                     nextPaymentTime_0: bigint,
                     endTime_0: bigint,
                     maxPayments_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executePayment(context: __compactRuntime.CircuitContext<PS>,
                 subscriptionId_0: Uint8Array,
                 callerPk_0: Uint8Array,
                 currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pauseSubscription(context: __compactRuntime.CircuitContext<PS>,
                    subscriptionId_0: Uint8Array,
                    callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resumeSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  cancelSubscription(context: __compactRuntime.CircuitContext<PS>,
                     subscriptionId_0: Uint8Array,
                     callerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  subscriptions: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): SubscriptionRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, SubscriptionRecord]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
