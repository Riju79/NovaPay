#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, token};

#[contracttype]
#[derive(Clone, Debug)]
pub struct BillingSetup {
    pub payer: Address,
    pub payee: Address,
    pub token: Address,
    pub limit: i128,              // Max amount allowed per billing cycle
    pub interval_seconds: u64,    // Length of the billing cycle (e.g. 30 days = 2592000s)
    pub last_charge_time: u64,    // Timestamp of the last successful charge
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
}

#[contract]
pub struct RecurringBillingContract;

#[contractimpl]
impl RecurringBillingContract {
    /// Initialize the recurring billing subscription configuration.
    pub fn initialize(
        env: Env,
        payer: Address,
        payee: Address,
        token: Address,
        limit: i128,
        interval_seconds: u64,
    ) {
        // Require payer authorization before doing anything
        payer.require_auth();

        assert!(limit > 0, "Billing limit must be a positive value.");
        assert!(interval_seconds > 0, "Billing cycle interval must be greater than zero.");

        // Allow re-initialization only if previous billing configuration is inactive
        if env.storage().instance().has(&DataKey::Config) {
            let existing: BillingSetup = env.storage().instance().get(&DataKey::Config).unwrap();
            assert!(
                !existing.is_active,
                "Previous billing configuration is still active. Cancel it before starting a new one."
            );
        }

        let setup = BillingSetup {
            payer,
            payee,
            token,
            limit,
            interval_seconds,
            last_charge_time: 0,
            is_active: true,
        };

        env.storage().instance().set(&DataKey::Config, &setup);
    }

    /// Executed by the payee (merchant) to pull the specified amount from the payer's wallet.
    /// Payer must have approved this contract address as a token spender beforehand.
    pub fn charge(env: Env, amount: i128) {
        let mut setup = Self::get_config(&env);
        assert!(setup.is_active, "Billing subscription is inactive.");
        assert!(amount > 0, "Charge amount must be positive.");
        assert!(amount <= setup.limit, "Charge amount exceeds the allowed billing cycle limit.");

        // Authenticate payee signature (only merchant can trigger charge)
        setup.payee.require_auth();

        let current_time = env.ledger().timestamp();
        
        // Ensure the correct cycle interval has elapsed since the last charge
        if setup.last_charge_time > 0 {
            let next_eligible_charge_time = setup.last_charge_time + setup.interval_seconds;
            assert!(
                current_time >= next_eligible_charge_time,
                "Billing cycle cycle limit reached. Not eligible for charging yet."
            );
        }

        // Execute token transfer using token allowance pre-authorized by the payer to this contract
        let token_client = token::Client::new(&env, &setup.token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &setup.payer,
            &setup.payee,
            &amount
        );

        // Record the last charge timestamp
        setup.last_charge_time = current_time;
        env.storage().instance().set(&DataKey::Config, &setup);
    }

    /// Deactivates / cancels the recurring billing plan. Can be called by either party.
    pub fn cancel(env: Env, signer: Address) {
        signer.require_auth();
        let mut setup = Self::get_config(&env);
        
        assert!(
            signer == setup.payer || signer == setup.payee,
            "Only the payer or the payee is authorized to cancel the billing plan."
        );
        assert!(setup.is_active, "Billing subscription is already canceled.");

        setup.is_active = false;
        env.storage().instance().set(&DataKey::Config, &setup);
    }

    /// Read function to fetch the current billing subscription state.
    pub fn get_config(env: &Env) -> BillingSetup {
        env.storage().instance().get(&DataKey::Config).expect("Billing configuration not initialized.")
    }
}
