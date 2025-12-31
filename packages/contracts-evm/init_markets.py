import subprocess
import os

def run_cast(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAILED: {result.stderr}")
    else:
        print(f"SUCCESS: {result.stdout}")
    return result.returncode

LAUNCHPAD_ENGINE = "0x7a886fc43508A37f7F5467AC7460F72C578Da19B"
USDC = "0x0C31bBb6dA82ba97fBAFbE3325Ee8757A4D724e3"
ALIEN_MARKET = "0xA428556d84374A92dde26B87a3cd607cE94Af91B"
BTC100K_MARKET = "0x82AFbBAD7eb0439131588f60487192E1e93bD81D"
RPC = "https://sepolia.base.org"

# 1. Approve USDC
run_cast(f'cast send {USDC} "approve(address,uint256)" {LAUNCHPAD_ENGINE} 2000000000000000000000 --rpc-url {RPC} --private-key $PRIVATE_KEY')

# 2. Create ALIEN Market
run_cast(f'cast send {LAUNCHPAD_ENGINE} "createMarket(address,uint256,string,string)" {ALIEN_MARKET} 1000000000000000000000 "UN Confirms Alien Life" "ALIEN" --rpc-url {RPC} --private-key $PRIVATE_KEY')

# 3. Create BTC100K Market
run_cast(f'cast send {LAUNCHPAD_ENGINE} "createMarket(address,uint256,string,string)" {BTC100K_MARKET} 1000000000000000000000 "BTC TWAP >= $100k" "BTC100K" --rpc-url {RPC} --private-key $PRIVATE_KEY')
