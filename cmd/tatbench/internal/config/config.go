package config

import "time"

type Node struct {
	Binary  string
	Home    string
	ChainID string
}

type TX struct {
	Node Node

	From   string
	To     string
	Prefix string

	Amount string

	Accounts int
	Count    int

	Timeout time.Duration

	GasPrices      string
	GasAdjustment  float64
	KeyringBackend string
	BroadcastMode  string
}

func DefaultTX() TX {
	return TX{
		Node: Node{
			Binary:  "/home/ubuntu/tatcore/tatcoind",
			Home:    "/home/ubuntu/.tatcore",
			ChainID: "tat-1",
		},

		From:   "faucet",
		Prefix: "bench",

		Amount: "1utat",

		Accounts: 5,
		Count:    1,

		Timeout: 30 * time.Second,

		GasPrices:      "0.025utat",
		GasAdjustment:  1.4,
		KeyringBackend: "test",
		BroadcastMode:  "sync",
	}
}
