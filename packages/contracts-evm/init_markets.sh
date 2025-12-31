set -ex

# Load .env
export $(grep -v '^#' .env | xargs)

USDC="0x0C31bBb6dA82ba97fBAfBE3325Ee8757A4D724e3"
LAUNCHPAD_ENGINE="0x7a886fc43508A37f7F5467AC7460F72C578Da19B"
ALIEN_MARKET="0xA428556d84374A92dde26B87a3cd607cE94Af91B"
BTC100K_MARKET="0x82AFbBAD7eb0439131588f60487192E1e93bD81D"
RPC="https://sepolia.base.org"

echo "1. Approving USDC..."
cast send $USDC "approve(address,uint256)" $LAUNCHPAD_ENGINE 2000000000000000000000 --rpc-url $RPC --private-key $PRIVATE_KEY

echo "Wait for state propagation..."
sleep 15

echo "2. Creating ALIEN market..."
cast send $LAUNCHPAD_ENGINE "createMarket(address,uint256,string,string)" $ALIEN_MARKET 1000000000000000000000 "UN Confirms Alien Life" "ALIEN" --rpc-url $RPC --private-key $PRIVATE_KEY

echo "3. Creating BTC100K market..."
cast send $LAUNCHPAD_ENGINE "createMarket(address,uint256,string,string)" $BTC100K_MARKET 1000000000000000000000 "BTC TWAP >= $100k" "BTC100K" --rpc-url $RPC --private-key $PRIVATE_KEY

echo "DONE"
