import subprocess
import os

LAUNCHPAD_ENGINE = "0x7a886fc43508A37f7F5467AC7460F72C578Da19B"
USDC = "0x0C31bBb6dA82ba97fBAfBE3325Ee8757A4D724e3"
ALIEN_MARKET = "0xA428556d84374A92dde26B87a3cd607cE94Af91B"
BTC100K_MARKET = "0x82AFbBAD7eb0439131588f60487192E1e93bD81D"
RPC = "https://sepolia.base.org"
PK = os.getenv("PRIVATE_KEY")

if not PK:
    print("ERROR: PRIVATE_KEY not found in env")
    exit(1)

def run(cmd):
    print(f"Executing: {cmd}")
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = process.communicate()
    print(f"STDOUT: {stdout}")
    print(f"STDERR: {stderr}")
    return process.returncode

# 1. Approve
print("--- Approving ---")
run(f'cast send {USDC} "approve(address,uint256)" {LAUNCHPAD_ENGINE} 1000000000000000000000000 --rpc-url {RPC} --private-key {PK}')

# 2. ALIEN
print("\n--- Creating ALIEN ---")
run(f'cast send {LAUNCHPAD_ENGINE} "createMarket(address,uint256,string,string)" {ALIEN_MARKET} 1000000000000000000000 "UN Confirms Alien Life" "ALIEN" --rpc-url {RPC} --private-key {PK}')

# 3. BTC100K
print("\n--- Creating BTC100K ---")
run(f'cast send {LAUNCHPAD_ENGINE} "createMarket(address,uint256,string,string)" {BTC100K_MARKET} 1000000000000000000000 "BTC TWAP >= $100k" "BTC100K" --rpc-url {RPC} --private-key {PK}')
