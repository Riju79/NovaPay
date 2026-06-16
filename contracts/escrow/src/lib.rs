#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, token};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Created = 0,
    Deposited = 1,
    Approved = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowState {
    pub payer: Address,
    pub recipient: Address,
    pub arbiter: Address,
    pub token: Address,
    pub amount: i128,
    pub status: EscrowStatus,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    State,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the escrow terms and entities.
    pub fn initialize(
        env: Env,
        payer: Address,
        recipient: Address,
        arbiter: Address,
        token: Address,
        amount: i128,
    ) {
        assert!(!env.storage().instance().has(&DataKey::State), "Contract is already initialized.");
        assert!(amount > 0, "Escrow amount must be positive.");

        let state = EscrowState {
            payer,
            recipient,
            arbiter,
            token,
            amount,
            status: EscrowStatus::Created,
        };

        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Executed by the payer to deposit requested funds into the contract's vault address.
    pub fn deposit(env: Env) {
        let mut state = Self::get_state(&env);
        assert_eq!(state.status, EscrowStatus::Created, "Escrow is not in the pending deposit state.");

        // Authenticate payer signature
        state.payer.require_auth();

        // Transfer tokens from payer's account to this contract address
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(&state.payer, &env.current_contract_address(), &state.amount);

        // Update status to Deposited
        state.status = EscrowStatus::Deposited;
        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Executed by Payer or Arbiter to approve and release the deposited funds to the recipient.
    pub fn approve(env: Env, signer: Address) {
        signer.require_auth();
        let mut state = Self::get_state(&env);
        assert_eq!(state.status, EscrowStatus::Deposited, "No deposited funds are available to release.");

        // Authorize access check: only payer or arbiter can release funds
        assert!(
            signer == state.payer || signer == state.arbiter,
            "Not authorized. Only the payer or the arbiter can release escrowed funds."
        );

        // Transfer funds from contract address to the recipient address
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(&env.current_contract_address(), &state.recipient, &state.amount);

        // Update status to Approved
        state.status = EscrowStatus::Approved;
        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Executed by Recipient or Arbiter to cancel the trade and refund the deposited funds to the payer.
    pub fn refund(env: Env, signer: Address) {
        signer.require_auth();
        let mut state = Self::get_state(&env);
        assert_eq!(state.status, EscrowStatus::Deposited, "No deposited funds are available to refund.");

        // Authorize access check: only recipient or arbiter can approve refunding
        assert!(
            signer == state.recipient || signer == state.arbiter,
            "Not authorized. Only the recipient or the arbiter can execute a refund."
        );

        // Transfer funds from contract address back to the payer address
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(&env.current_contract_address(), &state.payer, &state.amount);

        // Update status to Refunded
        state.status = EscrowStatus::Refunded;
        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Read function to fetch details of the current escrow setup.
    pub fn get_state(env: &Env) -> EscrowState {
        env.storage().instance().get(&DataKey::State).expect("Contract is not initialized.")
    }
}
