/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sooth_protocol.json`.
 */
export type SoothProtocol = {
  "address": "23pTwMDF5Y9FFjnaqr2411cXVN2qfYmvuHMmsaeHVPmG",
  "metadata": {
    "name": "soothProtocol",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Sooth Protocol - Prediction Markets on Solana"
  },
  "instructions": [
    {
      "name": "cancelOrder",
      "docs": [
        "Cancel limit order"
      ],
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "order.order_id",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createLimitOrder",
      "docs": [
        "Create limit order"
      ],
      "discriminator": [
        76,
        161,
        70,
        122,
        82,
        20,
        142,
        75
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "market"
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              }
            ]
          }
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "arg",
                "path": "orderId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "orderId",
          "type": "u64"
        },
        {
          "name": "outcome",
          "type": "u8"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createMarket",
      "docs": [
        "Create a new prediction market"
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "governor",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "marketId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketId",
          "type": "u64"
        },
        {
          "name": "bParam",
          "type": "u128"
        },
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Deposit USDC into trader vault"
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "traderVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  97,
                  100,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "traderVault"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeGovernorVault",
      "docs": [
        "Initialize Governor Vault"
      ],
      "discriminator": [
        56,
        243,
        192,
        160,
        232,
        235,
        57,
        197
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "governorVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  111,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  118,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "governorVault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "defaultBBase",
          "type": "u128"
        },
        {
          "name": "defaultFeeBps",
          "type": "u16"
        },
        {
          "name": "reserveFactorBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeLpBalance",
      "docs": [
        "Initialize LP balance account"
      ],
      "discriminator": [
        71,
        50,
        153,
        250,
        213,
        161,
        2,
        106
      ],
      "accounts": [
        {
          "name": "lp",
          "writable": true,
          "signer": true
        },
        {
          "name": "lpBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lp"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializePosition",
      "docs": [
        "Initialize user position for a market"
      ],
      "discriminator": [
        219,
        192,
        234,
        71,
        190,
        191,
        102,
        80
      ],
      "accounts": [
        {
          "name": "trader",
          "writable": true,
          "signer": true
        },
        {
          "name": "market"
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "trader"
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeTraderVault",
      "docs": [
        "Initialize trader vault"
      ],
      "discriminator": [
        193,
        186,
        253,
        227,
        74,
        14,
        245,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "traderVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  97,
                  100,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "traderVault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeUserBalance",
      "docs": [
        "Initialize user balance account"
      ],
      "discriminator": [
        65,
        60,
        31,
        85,
        143,
        18,
        45,
        58
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "lpDeposit",
      "docs": [
        "LP deposit USDC to governor vault"
      ],
      "discriminator": [
        27,
        77,
        210,
        69,
        12,
        43,
        148,
        16
      ],
      "accounts": [
        {
          "name": "lp",
          "writable": true,
          "signer": true
        },
        {
          "name": "governorVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  111,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "lpBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lp"
              }
            ]
          }
        },
        {
          "name": "lpTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  118,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "governorVault"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "assets",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lpWithdraw",
      "docs": [
        "LP withdraw USDC from governor vault"
      ],
      "discriminator": [
        205,
        206,
        130,
        170,
        173,
        51,
        11,
        169
      ],
      "accounts": [
        {
          "name": "lp",
          "writable": true,
          "signer": true
        },
        {
          "name": "governorVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  111,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "lpBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lp"
              }
            ]
          }
        },
        {
          "name": "lpTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  118,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "governorVault"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "assets",
          "type": "u64"
        }
      ]
    },
    {
      "name": "matchOrders",
      "docs": [
        "Match two orders (manual matching)"
      ],
      "discriminator": [
        17,
        1,
        201,
        93,
        7,
        51,
        251,
        134
      ],
      "accounts": [
        {
          "name": "orderA",
          "writable": true
        },
        {
          "name": "orderB",
          "writable": true
        },
        {
          "name": "makerA"
        },
        {
          "name": "makerB"
        },
        {
          "name": "positionA",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "makerA"
              },
              {
                "kind": "account",
                "path": "order_a.market",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "positionB",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "makerB"
              },
              {
                "kind": "account",
                "path": "order_b.market",
                "account": "order"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "settleMarket",
      "docs": [
        "Settle market with winning outcome"
      ],
      "discriminator": [
        193,
        153,
        95,
        216,
        166,
        6,
        144,
        217
      ],
      "accounts": [
        {
          "name": "governor",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "winningOutcome",
          "type": "u8"
        }
      ]
    },
    {
      "name": "trade",
      "docs": [
        "Execute AMM trade with LMSR pricing"
      ],
      "discriminator": [
        178,
        144,
        26,
        216,
        241,
        187,
        206,
        130
      ],
      "accounts": [
        {
          "name": "trader",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "trader"
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "trader"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": "u8"
        },
        {
          "name": "deltaShares",
          "type": "i64"
        },
        {
          "name": "maxCost",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw USDC from trader vault"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "traderVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  97,
                  100,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "userBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "traderVault"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "governorVault",
      "discriminator": [
        99,
        129,
        48,
        83,
        217,
        243,
        201,
        37
      ]
    },
    {
      "name": "lpBalance",
      "discriminator": [
        71,
        78,
        188,
        110,
        190,
        54,
        78,
        146
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
      ]
    },
    {
      "name": "traderVault",
      "discriminator": [
        243,
        162,
        12,
        156,
        240,
        79,
        134,
        35
      ]
    },
    {
      "name": "userBalance",
      "discriminator": [
        187,
        237,
        208,
        146,
        86,
        132,
        29,
        191
      ]
    },
    {
      "name": "userPosition",
      "discriminator": [
        251,
        248,
        209,
        245,
        83,
        234,
        17,
        27
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6001,
      "name": "marketNotLive",
      "msg": "Market is not live"
    },
    {
      "code": 6002,
      "name": "marketAlreadySettled",
      "msg": "Market already settled"
    },
    {
      "code": 6003,
      "name": "invalidOutcome",
      "msg": "Invalid outcome"
    },
    {
      "code": 6004,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6005,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6006,
      "name": "zeroDelta",
      "msg": "Zero delta shares"
    },
    {
      "code": 6007,
      "name": "slippageExceeded",
      "msg": "Slippage exceeded"
    },
    {
      "code": 6008,
      "name": "insufficientShares",
      "msg": "Insufficient shares"
    },
    {
      "code": 6009,
      "name": "zeroAmount",
      "msg": "Zero amount"
    },
    {
      "code": 6010,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 6011,
      "name": "underflow",
      "msg": "Arithmetic underflow"
    },
    {
      "code": 6012,
      "name": "lockedFunds",
      "msg": "Locked funds"
    },
    {
      "code": 6013,
      "name": "invalidPrice",
      "msg": "Invalid price"
    },
    {
      "code": 6014,
      "name": "orderAlreadyCancelled",
      "msg": "Order already cancelled"
    },
    {
      "code": 6015,
      "name": "orderFullyFilled",
      "msg": "Order fully filled"
    },
    {
      "code": 6016,
      "name": "marketMismatch",
      "msg": "Market mismatch"
    },
    {
      "code": 6017,
      "name": "orderCancelled",
      "msg": "Order cancelled"
    },
    {
      "code": 6018,
      "name": "sameOutcome",
      "msg": "Same outcome"
    },
    {
      "code": 6019,
      "name": "pricesDoNotCross",
      "msg": "Prices do not cross"
    },
    {
      "code": 6020,
      "name": "noMatchAmount",
      "msg": "No match amount"
    }
  ],
  "types": [
    {
      "name": "governorVault",
      "docs": [
        "Governor Vault for LP liquidity management"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "docs": [
              "Total LP shares issued"
            ],
            "type": "u64"
          },
          {
            "name": "totalAssets",
            "docs": [
              "Total assets (USDC) in vault"
            ],
            "type": "u64"
          },
          {
            "name": "totalLockedExposure",
            "docs": [
              "Total exposure locked across all markets"
            ],
            "type": "u64"
          },
          {
            "name": "defaultBBase",
            "docs": [
              "Default b parameter for new markets"
            ],
            "type": "u128"
          },
          {
            "name": "defaultFeeBps",
            "docs": [
              "Default fee in basis points"
            ],
            "type": "u16"
          },
          {
            "name": "reserveFactorBps",
            "docs": [
              "Reserve factor in basis points"
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lpBalance",
      "docs": [
        "LP share balance for a user"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "governor",
            "type": "pubkey"
          },
          {
            "name": "bParam",
            "type": "u128"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "qYes",
            "type": "i128"
          },
          {
            "name": "qNo",
            "type": "i128"
          },
          {
            "name": "isLive",
            "type": "bool"
          },
          {
            "name": "isSettled",
            "type": "bool"
          },
          {
            "name": "winningOutcome",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "order",
      "docs": [
        "Limit order"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "filled",
            "type": "u64"
          },
          {
            "name": "isCancelled",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "traderVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userBalance",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "freeBalance",
            "type": "u64"
          },
          {
            "name": "lockedBalance",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "yesBalance",
            "type": "u64"
          },
          {
            "name": "noBalance",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
